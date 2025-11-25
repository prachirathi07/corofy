# Mail Status Values

This document describes all possible values for the `mail_status` field in the `scraped_data` table.

## Status Flow

```
new → email_sent → followup_5day_sent → followup_10day_sent
  ↓         ↓              ↓                    ↓
failed  reply_received  reply_received    reply_received
```

## Status Values

### `new`
- **Description**: Initial state when a lead is first created
- **Default**: Yes (default value)
- **Next States**: `email_sent`, `scheduled`, `failed`

### `scheduled`
- **Description**: Email is scheduled to be sent at a specific time
- **Next States**: `email_sent`, `failed`

### `email_sent`
- **Description**: Initial email has been successfully sent
- **Next States**: `followup_5day_sent`, `reply_received`, `failed`
- **Notes**: 
  - This is the state after the first email is sent
  - Follow-ups are scheduled when this status is set
  - 5-day follow-up can be sent when status is `email_sent`

### `followup_5day_sent`
- **Description**: 5-day follow-up email has been successfully sent
- **Next States**: `followup_10day_sent`, `reply_received`, `failed`
- **Notes**: 
  - Set when 5-day follow-up is sent
  - 10-day follow-up can be sent when status is `followup_5day_sent`

### `followup_10day_sent`
- **Description**: 10-day follow-up email has been successfully sent
- **Next States**: `reply_received`, `failed`
- **Notes**: 
  - Set when 10-day follow-up is sent
  - This is the final follow-up email

### `reply_received`
- **Description**: A reply has been received from the lead
- **Next States**: None (terminal state)
- **Notes**: 
  - All pending follow-ups are cancelled when this status is set
  - This is a terminal state - no more emails should be sent

### `failed`
- **Description**: Email sending failed
- **Next States**: `email_sent` (after retry), `scheduled` (after retry)
- **Notes**: 
  - Retry logic may attempt to resend
  - After max retries, lead may remain in this state

## Implementation Details

### Setting Status in Code

1. **Initial Email Sent** (`email_sending_service.py`):
   ```python
   update_data["mail_status"] = "email_sent"  # for email_type == "initial"
   ```

2. **5-Day Follow-up Sent** (`email_sending_service.py`):
   ```python
   update_data["mail_status"] = "followup_5day_sent"  # for email_type == "followup_5day"
   ```

3. **10-Day Follow-up Sent** (`email_sending_service.py`):
   ```python
   update_data["mail_status"] = "followup_10day_sent"  # for email_type == "followup_10day"
   ```

4. **Reply Received** (`reply_service.py`):
   ```python
   update_data["mail_status"] = "reply_received"
   ```

### Querying by Status

- **Find leads ready for 5-day follow-up**:
  ```python
  .eq("mail_status", "email_sent")
  ```

- **Find leads ready for 10-day follow-up**:
  ```python
  .eq("mail_status", "followup_5day_sent")
  ```

- **Find leads with replies**:
  ```python
  .eq("mail_status", "reply_received")
  ```

## Backward Compatibility

The `followup_5_sent` and `followup_10_sent` TEXT columns are still maintained for backward compatibility, but `mail_status` is now the primary source of truth for email state.

- `followup_5_sent`: `"true"`, `"false"`, `"cancelled"`, or `NULL`
- `followup_10_sent`: `"true"`, `"false"`, `"cancelled"`, or `NULL`

These fields are updated alongside `mail_status` but queries should primarily use `mail_status`.

