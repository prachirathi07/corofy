"""
Transaction management utilities for Supabase operations.
Provides atomic operations and rollback capabilities.
"""

from typing import Any, Callable, Optional, TypeVar, List
from supabase import Client
import logging
from functools import wraps
import asyncio

logger = logging.getLogger(__name__)

T = TypeVar('T')

class TransactionContext:
    """
    Context manager for database transactions.
    Note: Supabase doesn't support native transactions via REST API,
    so we implement compensating transactions (rollback via delete/update).
    """
    
    def __init__(self, db: Client):
        self.db = db
        self.operations: List[dict] = []
        self.committed = False
        self.rolled_back = False
    
    def __enter__(self):
        logger.debug("🔄 Transaction started")
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            # Exception occurred - rollback
            logger.warning(f"⚠️ Transaction failed: {exc_val}")
            self.rollback()
            return False  # Re-raise exception
        
        if not self.committed and not self.rolled_back:
            # Auto-commit if not explicitly committed
            self.commit()
        
        return True
    
    async def __aenter__(self):
        logger.debug("🔄 Async transaction started")
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            logger.warning(f"⚠️ Async transaction failed: {exc_val}")
            await self.rollback_async()
            return False
        
        if not self.committed and not self.rolled_back:
            await self.commit_async()
        
        return True
    
    def track_insert(self, table: str, record_id: str):
        """Track an insert operation for potential rollback"""
        self.operations.append({
            "type": "insert",
            "table": table,
            "id": record_id
        })
    
    def track_update(self, table: str, record_id: str, old_data: dict):
        """Track an update operation for potential rollback"""
        self.operations.append({
            "type": "update",
            "table": table,
            "id": record_id,
            "old_data": old_data
        })
    
    def track_delete(self, table: str, deleted_data: dict):
        """Track a delete operation for potential rollback"""
        self.operations.append({
            "type": "delete",
            "table": table,
            "data": deleted_data
        })
    
    def commit(self):
        """Commit transaction (clear operation history)"""
        logger.info(f"✅ Transaction committed ({len(self.operations)} operations)")
        self.operations.clear()
        self.committed = True
    
    async def commit_async(self):
        """Async commit"""
        self.commit()
    
    def rollback(self):
        """Rollback all tracked operations"""
        if self.rolled_back:
            return
        
        logger.warning(f"🔄 Rolling back {len(self.operations)} operations...")
        
        # Rollback in reverse order
        for operation in reversed(self.operations):
            try:
                if operation["type"] == "insert":
                    # Rollback insert by deleting
                    self.db.table(operation["table"]).delete().eq(
                        "id", operation["id"]
                    ).execute()
                    logger.debug(f"  ↩️ Rolled back insert: {operation['table']}/{operation['id']}")
                
                elif operation["type"] == "update":
                    # Rollback update by restoring old data
                    self.db.table(operation["table"]).update(
                        operation["old_data"]
                    ).eq("id", operation["id"]).execute()
                    logger.debug(f"  ↩️ Rolled back update: {operation['table']}/{operation['id']}")
                
                elif operation["type"] == "delete":
                    # Rollback delete by re-inserting
                    self.db.table(operation["table"]).insert(
                        operation["data"]
                    ).execute()
                    logger.debug(f"  ↩️ Rolled back delete: {operation['table']}")
            
            except Exception as e:
                logger.error(f"❌ Rollback failed for operation {operation}: {e}")
        
        self.operations.clear()
        self.rolled_back = True
        logger.info("✅ Rollback complete")
    
    async def rollback_async(self):
        """Async rollback"""
        self.rollback()


def transactional(func: Callable[..., T]) -> Callable[..., T]:
    """
    Decorator for transactional functions.
    Automatically creates transaction context and handles rollback on error.
    
    Usage:
        @transactional
        async def process_batch(db, leads):
            # All operations here are transactional
            ...
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        # Find db client in args or kwargs
        db = None
        for arg in args:
            if isinstance(arg, Client):
                db = arg
                break
        
        if db is None:
            db = kwargs.get('db')
        
        if db is None:
            # No db client found, run without transaction
            logger.warning("No database client found, running without transaction")
            return await func(*args, **kwargs)
        
        # Run with transaction
        async with TransactionContext(db) as tx:
            # Add transaction to kwargs
            kwargs['tx'] = tx
            result = await func(*args, **kwargs)
            return result
    
    return wrapper


class BatchProcessor:
    """
    Utility for processing items in batches with transaction support.
    """
    
    def __init__(self, db: Client, batch_size: int = 100):
        self.db = db
        self.batch_size = batch_size
    
    async def process_batch(
        self,
        items: List[Any],
        processor: Callable[[Any], Any],
        on_error: str = "continue"  # continue, stop, rollback
    ) -> dict:
        """
        Process items in batches with error handling.
        
        Args:
            items: List of items to process
            processor: Async function to process each item
            on_error: Error handling strategy
        
        Returns:
            Dict with processing statistics
        """
        total = len(items)
        processed = 0
        succeeded = 0
        failed = 0
        errors = []
        
        logger.info(f"📦 Processing {total} items in batches of {self.batch_size}")
        
        for i in range(0, total, self.batch_size):
            batch = items[i:i + self.batch_size]
            batch_num = (i // self.batch_size) + 1
            
            logger.info(f"  Processing batch {batch_num} ({len(batch)} items)...")
            
            async with TransactionContext(self.db) as tx:
                batch_succeeded = 0
                batch_failed = 0
                
                for item in batch:
                    try:
                        await processor(item)
                        batch_succeeded += 1
                        succeeded += 1
                    except Exception as e:
                        batch_failed += 1
                        failed += 1
                        errors.append({"item": item, "error": str(e)})
                        
                        if on_error == "stop":
                            logger.error(f"❌ Stopping batch processing due to error: {e}")
                            raise
                        elif on_error == "rollback":
                            logger.warning(f"⚠️ Rolling back batch due to error: {e}")
                            raise
                        else:  # continue
                            logger.warning(f"⚠️ Error processing item (continuing): {e}")
                    
                    processed += 1
                
                # Commit batch if no errors or on_error is continue
                if batch_failed == 0 or on_error == "continue":
                    tx.commit()
                    logger.info(
                        f"  ✅ Batch {batch_num} complete: "
                        f"{batch_succeeded} succeeded, {batch_failed} failed"
                    )
        
        logger.info(
            f"📊 Batch processing complete: "
            f"{succeeded}/{total} succeeded, {failed} failed"
        )
        
        return {
            "total": total,
            "processed": processed,
            "succeeded": succeeded,
            "failed": failed,
            "errors": errors
        }
