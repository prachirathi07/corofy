"""
Service for checking email replies via n8n and analyzing them
"""
from typing import Dict, Any, List, Optional
from datetime import datetime
import httpx
from app.services.openai_service import OpenAIService
from app.core.database import SupabaseClient
from app.core.config import settings
import logging
import json
import asyncio

logger = logging.getLogger(__name__)

class ReplyService:
    """
    Service for checking and analyzing email replies
    Delegates the actual Gmail check to n8n, but handles logic/analysis here.
    """
    
    def __init__(self):
        self.db = SupabaseClient.get_client()
        self.openai_service = OpenAIService()
        # You need to create this webhook in n8n
        self.n8n_check_reply_url = "https://n8n.srv963601.hstgr.cloud/webhook/check-reply" 
    
    async def check_and_analyze_replies(self) -> Dict[str, Any]:
        """
        Check for new replies and analyze them
        """
        try:
            # Get all sent emails with gmail_thread_id that haven't been marked as replied
            sent_leads = (
                self.db.table("scraped_data")
                .select("*")
                .not_.is_("gmail_thread_id", "null")
                .in_("mail_status", ["email_sent", "sent", "2nd followup sent"])
                .execute()
            )
            
            if not sent_leads.data:
                return {
                    "success": True,
                    "checked": 0,
                    "new_replies": 0,
                    "analyzed": 0,
                    "message": "No sent leads with thread IDs to check"
                }
            
            checked = 0
            new_replies = 0
            analyzed = 0
            
            logger.info(f"🔍 Checking replies for {len(sent_leads.data)} leads via n8n...")
            
            for lead in sent_leads.data:
                try:
                    lead_id = lead["id"]
                    thread_id = lead.get("gmail_thread_id")
                    
                    if not thread_id:
                        continue
                    
                    checked += 1
                    
                    # Call n8n to check this thread
                    reply_data = await self._check_reply_via_n8n(thread_id, lead_id)
                    
                    if reply_data and reply_data.get("has_reply"):
                        new_replies += 1
                        logger.info(f"📩 New reply detected for lead {lead_id} (Thread: {thread_id})")
                        
                        # Analyze the reply (Logic stays in Python!)
                        try:
                            analysis_result = await self._analyze_reply(reply_data, lead_id)
                            if analysis_result.get("success"):
                                analyzed += 1
                                logger.info(f"✅ Analysis successful for lead {lead_id}")
                            else:
                                logger.warning(f"⚠️ Analysis failed for lead {lead_id}: {analysis_result.get('error', 'Unknown error')}")
                        except Exception as e:
                            logger.error(f"❌ Exception during analysis for lead {lead_id}: {e}", exc_info=True)
                            
                except Exception as e:
                    logger.error(f"Error checking replies for lead {lead.get('id')}: {e}")
                    continue
            
            logger.info(f"📧 Reply check completed: {checked} checked, {new_replies} new replies, {analyzed} analyzed")
            
            return {
                "success": True,
                "checked": checked,
                "new_replies": new_replies,
                "analyzed": analyzed
            }
        
        except Exception as e:
            logger.error(f"Error checking replies: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }
    
    async def _check_reply_via_n8n(self, thread_id: str, lead_id: str) -> Optional[Dict[str, Any]]:
        """
        Call n8n webhook to check if a thread has a reply
        """
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    self.n8n_check_reply_url,
                    json={"gmail_thread_id": thread_id},
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code != 200:
                    logger.warning(f"n8n returned status {response.status_code} for thread {thread_id}")
                    return None
                
                # Check if response has content
                response_text = response.text.strip()
                if not response_text:
                    logger.debug(f"n8n returned empty response for thread {thread_id}")
                    return None
                
                try:
                    data = response.json()
                except ValueError as e:
                    logger.warning(f"n8n returned non-JSON response for thread {thread_id}: {response_text[:100]}")
                    return None
                
                # Expected n8n response: { "has_reply": true, "reply_body": "...", "reply_subject": "...", "reply_from": "..." }
                # Also supports legacy format: { "has_reply": true, "body": "...", "subject": "...", "from": "..." }
                if data.get("has_reply"):
                    reply_data = {
                        "has_reply": True,
                        "reply_body": data.get("reply_body") or data.get("body", ""),
                        "reply_subject": data.get("reply_subject") or data.get("subject", ""),
                        "reply_from": data.get("reply_from") or data.get("from", ""),
                        "lead_id": lead_id
                    }
                    logger.info(f"📨 Reply data received from n8n for thread {thread_id}: body_length={len(reply_data.get('reply_body', ''))}, subject={reply_data.get('reply_subject', 'N/A')[:50]}")
                    return reply_data
                
                return None
                
        except Exception as e:
            logger.error(f"Error calling n8n for thread {thread_id}: {e}")
            return None

    async def _analyze_reply(self, reply_data: Dict[str, Any], lead_id: str) -> Dict[str, Any]:
        """
        Analyze a reply using OpenAI to get summary and priority
        """
        try:
            reply_body = reply_data.get("reply_body", "")
            reply_subject = reply_data.get("reply_subject", "")
            
            logger.info(f"🔍 Starting analysis for lead {lead_id}: body_length={len(reply_body)}, subject={reply_subject[:50] if reply_subject else 'N/A'}")
            logger.debug(f"📝 Full reply_data keys: {list(reply_data.keys())}")
            
            if not reply_body:
                logger.warning(f"⚠️ No reply body found for lead {lead_id}. Reply data: {reply_data}")
                # Even if no body, mark as received so we stop follow-ups
                self.db.table("scraped_data").update({
                    "mail_status": "reply_received"
                }).eq("id", lead_id).execute()
                return {"success": False, "error": "No reply body to analyze"}
            
            # Use OpenAI to analyze the reply
            analysis_prompt = f"""Analyze the following email reply and provide:
1. A brief summary (2-3 sentences)
2. Priority level: "high", "medium", or "low"
   - High: Interested, wants to proceed, asking for next steps
   - Medium: Neutral, asking questions, needs more information
   - Low: Not interested, negative response, unsubscribe request

Reply Subject: {reply_subject}
Reply Body: {reply_body[:2000]}

Return your response as JSON with keys: "summary" and "priority"."""
            
            try:
                # Call OpenAI
                response = await asyncio.to_thread(
                    lambda: self.openai_service.client.chat.completions.create(
                        model=self.openai_service.model,
                        messages=[
                            {"role": "system", "content": "You are an expert at analyzing business email replies. Return JSON only."},
                            {"role": "user", "content": analysis_prompt}
                        ],
                        response_format={"type": "json_object"},
                        max_tokens=500,
                        temperature=0.3
                    )
                )
                
                result_text = response.choices[0].message.content.strip()
                analysis = json.loads(result_text)
                
                summary = analysis.get("summary", "")
                priority = analysis.get("priority", "medium").lower()
                
                # Validate priority
                if priority not in ["high", "medium", "low"]:
                    priority = "medium"
                
                # Update scraped_data with summary and priority
                update_data = {
                    "mail_status": "reply_received", # This STOPS follow-ups
                    "reply_priority": priority,
                    "mail_replies": summary
                }
                
                self.db.table("scraped_data").update(update_data).eq("id", lead_id).execute()
                
                # Cancel any pending follow-ups since lead has replied
                try:
                    from app.services.followup_service import FollowUpService
                    followup_service = FollowUpService()
                    followup_service.cancel_followups_for_lead(lead_id)
                    logger.info(f"✅ Cancelled pending follow-ups for lead {lead_id} (lead replied)")
                except Exception as e:
                    logger.warning(f"⚠️ Failed to cancel follow-ups for lead {lead_id}: {e}")
                
                logger.info(f"✅ Analyzed reply for lead {lead_id}: Priority={priority}")
                
                return {
                    "success": True,
                    "summary": summary,
                    "priority": priority
                }
            
            except Exception as e:
                logger.error(f"❌ Error analyzing reply with OpenAI for lead {lead_id}: {e}", exc_info=True)
                logger.error(f"❌ Exception type: {type(e).__name__}")
                logger.error(f"❌ Exception details: {str(e)}")
                # Still update status to reply_received even if analysis fails
                self.db.table("scraped_data").update({
                    "mail_status": "reply_received"
                }).eq("id", lead_id).execute()
                
                # Cancel any pending follow-ups since lead has replied
                try:
                    from app.services.followup_service import FollowUpService
                    followup_service = FollowUpService()
                    followup_service.cancel_followups_for_lead(lead_id)
                    logger.info(f"✅ Cancelled pending follow-ups for lead {lead_id} (lead replied)")
                except Exception as e:
                    logger.warning(f"⚠️ Failed to cancel follow-ups for lead {lead_id}: {e}")
                
                return {
                    "success": False,
                    "error": str(e),
                    "status_updated": True
                }
        
        except Exception as e:
            logger.error(f"❌ Error in _analyze_reply for lead {lead_id}: {e}", exc_info=True)
            logger.error(f"❌ Exception type: {type(e).__name__}")
            return {"success": False, "error": str(e)}
