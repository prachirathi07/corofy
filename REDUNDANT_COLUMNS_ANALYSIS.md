# Redundant Columns Analysis

This document identifies columns in the `scraped_data` table that can be safely removed or are redundant.

## Columns That Can Be Removed

### 1. **`status` (VARCHAR)**
**Status:** ⚠️ **REDUNDANT** - Can be removed after code update

**Reason:**
- `mail_status` is the primary status field used throughout the codebase
- `status` is only used in `simplified_email_tracking_service.py` for processing tracking
- This can be replaced with `mail_status` values

**Current Usage:**
- `app/services/simplified_email_tracking_service.py`: Sets `status = "processing"` 
- Can be replaced with `mail_status = "processing"` or a new status value

**Action Required:**
1. Update `simplified_email_tracking_service.py` to use `mail_status` instead of `status`
2. Remove `status` column from database

---

### 2. **`wait_initial_email` (BOOLEAN)**
**Status:** ✅ **SAFE TO REMOVE** - Not used in logic

**Reason:**
- Only appears in model definition and router SELECT statements
- Never actually used in any business logic
- No queries filter by this column

**Current Usage:**
- `app/models/lead.py`: Model definition only
- `app/routers/leads.py`: Only in SELECT statement (line 275)

**Action Required:**
1. Remove from model
2. Remove from router SELECT
3. Drop column from database

---

### 3. **`wait_followup_5` (BOOLEAN)**
**Status:** ✅ **SAFE TO REMOVE** - Not used in logic

**Reason:**
- Only appears in model definition and router SELECT statements
- Never actually used in any business logic
- No queries filter by this column

**Current Usage:**
- `app/models/lead.py`: Model definition only
- `app/routers/leads.py`: Only in SELECT statement (line 275)

**Action Required:**
1. Remove from model
2. Remove from router SELECT
3. Drop column from database

---

### 4. **`wait_followup_10` (BOOLEAN)**
**Status:** ✅ **SAFE TO REMOVE** - Not used in logic

**Reason:**
- Only appears in model definition and router SELECT statements
- Never actually used in any business logic
- No queries filter by this column

**Current Usage:**
- `app/models/lead.py`: Model definition only
- `app/routers/leads.py`: Only in SELECT statement (line 275)

**Action Required:**
1. Remove from model
2. Remove from router SELECT
3. Drop column from database

---

## Columns That Are Redundant But Still Used (Keep for Now)

### 5. **`followup_5_sent` (TEXT)**
**Status:** ⚠️ **REDUNDANT BUT STILL USED** - Keep for backward compatibility

**Reason:**
- `mail_status` is now the primary source of truth
- Still used in queries for backward compatibility checks
- Still updated when follow-ups are sent/cancelled

**Current Usage:**
- `app/services/followup_service.py`: Used in queries and updates
- Can be derived from `mail_status`:
  - `mail_status = 'email_sent'` → `followup_5_sent = false/null`
  - `mail_status = 'followup_5day_sent'` → `followup_5_sent = true`
  - `mail_status = 'reply_received'` → `followup_5_sent = cancelled`

**Future Action:**
- Can be removed after updating all queries to use `mail_status` only
- Low priority - not causing issues

---

### 6. **`followup_10_sent` (TEXT)**
**Status:** ⚠️ **REDUNDANT BUT STILL USED** - Keep for backward compatibility

**Reason:**
- `mail_status` is now the primary source of truth
- Still used in queries for backward compatibility checks
- Still updated when follow-ups are sent/cancelled

**Current Usage:**
- `app/services/followup_service.py`: Used in queries and updates
- Can be derived from `mail_status`:
  - `mail_status = 'followup_5day_sent'` → `followup_10_sent = false/null`
  - `mail_status = 'followup_10day_sent'` → `followup_10_sent = true`
  - `mail_status = 'reply_received'` → `followup_10_sent = cancelled`

**Future Action:**
- Can be removed after updating all queries to use `mail_status` only
- Low priority - not causing issues

---

## Columns That Are NOT Redundant (Keep)

### ✅ **`mail_status` (TEXT)**
- **Primary status field** - Used everywhere
- Tracks: new, scheduled, email_sent, followup_5day_sent, followup_10day_sent, reply_received, failed

### ✅ **`email_processed` (BOOLEAN)**
- Used in `simplified_email_tracking_service.py` for batch processing
- Tracks which leads have been processed in daily batches
- **Keep this column**

### ✅ **`followup_5_scheduled_date` (DATE)**
- Tracks when 5-day follow-up should be sent
- Used in queries to find due follow-ups
- **Keep this column**

### ✅ **`followup_10_scheduled_date` (DATE)**
- Tracks when 10-day follow-up should be sent
- Used in queries to find due follow-ups
- **Keep this column**

---

## Summary

### Immediate Removal (Safe):
1. ✅ `wait_initial_email` - Not used
2. ✅ `wait_followup_5` - Not used
3. ✅ `wait_followup_10` - Not used

### After Code Update:
4. ⚠️ `status` - Replace with `mail_status` in `simplified_email_tracking_service.py`

### Future Cleanup (Low Priority):
5. ⚠️ `followup_5_sent` - Can remove after updating queries
6. ⚠️ `followup_10_sent` - Can remove after updating queries

---

## Migration SQL

```sql
-- Step 1: Remove unused wait columns
ALTER TABLE scraped_data 
  DROP COLUMN IF EXISTS wait_initial_email,
  DROP COLUMN IF EXISTS wait_followup_5,
  DROP COLUMN IF EXISTS wait_followup_10;

-- Step 2: Update simplified_email_tracking_service.py to use mail_status instead of status
-- (Do this in code first, then remove column)

-- Step 3: Remove status column (after code update)
ALTER TABLE scraped_data 
  DROP COLUMN IF EXISTS status;

-- Step 4: (Future) Remove followup_5_sent and followup_10_sent after updating all queries
-- ALTER TABLE scraped_data 
--   DROP COLUMN IF EXISTS followup_5_sent,
--   DROP COLUMN IF EXISTS followup_10_sent;
```

