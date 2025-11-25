"""
Service for sending email data to n8n webhook
"""
import httpx
import logging
from typing import Dict, Any, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

class WebhookService:
    """
    Service for sending email data to n8n webhook
    """
    
    def __init__(self):
        # Different webhook URLs for different email types
        self.webhook_url_initial = "https://n8n.srv963601.hstgr.cloud/webhook/5c430cd6-c53b-43bc-9960-1cd16d428991"
        self.webhook_url_5day_followup = "https://n8n.srv963601.hstgr.cloud/webhook/5-day-followup"
        self.webhook_url_10day_followup = "https://n8n.srv963601.hstgr.cloud/webhook/5c430cd6-c53b-43bc-9960-1cd16d428991"  # Default for now
        self.timeout = 30.0  # 30 seconds timeout
    
    def _get_webhook_url(self, email_type: str) -> str:
        """
        Get the appropriate webhook URL based on email type
        
        Args:
            email_type: Type of email (initial, followup_5day, followup_10day)
        
        Returns:
            Webhook URL string
        """
        if email_type == "followup_5day":
            return self.webhook_url_5day_followup
        elif email_type == "followup_10day":
            return self.webhook_url_10day_followup
        else:
            return self.webhook_url_initial
    
    async def send_email_via_webhook(
        self,
        email_to: str,
        subject: str,
        body: str,
        lead_id: Optional[str] = None,
        email_type: Optional[str] = "initial",
        gmail_thread_id: Optional[str] = None,
        gmail_message_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send email data to n8n webhook
        
        Args:
            email_to: Recipient email address
            subject: Email subject
            body: Email body
            lead_id: Optional lead ID for tracking
            email_type: Type of email (initial, followup_5day, followup_10day)
            gmail_thread_id: Optional thread ID for follow-ups (to reply in same thread)
            gmail_message_id: Optional message ID for follow-ups (from initial email)
        
        Returns:
            Dict with success status and response from webhook
        """
        # Get the appropriate webhook URL based on email type (before try block for error handling)
        webhook_url = self._get_webhook_url(email_type)
        
        try:
            # Prepare payload for n8n webhook
            # Format: email_id, subject, body, gmail_thread_id (for follow-ups)
            payload = {
                "email_id": email_to,  # email_id as requested
                "subject": subject,     # subject line
                "body": body            # email body
            }
            
            # Add gmail_thread_id and message_id for follow-ups (n8n should use this to reply in same thread)
            # CRITICAL: Always send gmail_thread_id and message_id if they exist for follow-ups
            if email_type.startswith("followup_"):
                if gmail_thread_id:
                    payload["gmail_thread_id"] = gmail_thread_id
                    logger.info(f"📎 Follow-up email: Using gmail_thread_id {gmail_thread_id} for same-thread reply")
                else:
                    logger.warning(f"⚠️ Follow-up email but gmail_thread_id is None/empty. Will create new thread.")
                
                if gmail_message_id:
                    payload["message_id"] = gmail_message_id
                    logger.info(f"📧 Follow-up email: Using message_id {gmail_message_id} from initial email")
                else:
                    logger.warning(f"⚠️ Follow-up email but message_id is None/empty.")
                
                logger.info(f"📦 Payload now includes gmail_thread_id: {payload.get('gmail_thread_id')}, message_id: {payload.get('message_id')}")
            else:
                logger.debug(f"Initial email - no gmail_thread_id or message_id needed")
            
            logger.info(f"🚀 WEBHOOK CALL: Sending email data to n8n webhook for {email_to}")
            logger.info(f"📤 WEBHOOK URL: {webhook_url}")
            logger.info(f"📧 Email type: {email_type}")
            logger.info(f"📦 WEBHOOK PAYLOAD: {payload}")
            logger.info(f"📧 Email subject: {subject[:100]}...")
            logger.info(f"📝 Email body length: {len(body)} characters")
            if email_type.startswith("followup_"):
                logger.info(f"🔗 gmail_thread_id in payload: {payload.get('gmail_thread_id', 'NOT FOUND - THIS IS THE PROBLEM!')}")
            
            # Send to webhook
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    webhook_url,
                    json=payload,
                    headers={
                        "Content-Type": "application/json"
                    }
                )
                
                # Check response
                response.raise_for_status()
                
                # Try to parse response
                try:
                    response_data = response.json()
                except:
                    response_data = {"message": response.text}
                
                logger.info(f"✅ WEBHOOK HTTP SUCCESS: Response for {email_to}: Status {response.status_code}")
                logger.info(f"📥 WEBHOOK RESPONSE DATA: {response_data}")
                
                # Check if n8n confirms email was sent
                # REQUIRED: n8n workflow MUST return message_id and gmail_thread_id from Gmail API
                is_success = False
                message_id = None
                gmail_thread_id = None
                
                # Check response status code
                if response.status_code in [200, 201]:
                    # Check for explicit success flag in response
                    if response_data.get("success") == True:
                        message_id = response_data.get("message_id")
                        gmail_thread_id = response_data.get("gmail_thread_id") or response_data.get("thread_id")  # Support both for backward compatibility
                        if message_id and gmail_thread_id:
                            is_success = True
                        else:
                            logger.warning(f"⚠️ Webhook returned success=True but missing message_id or gmail_thread_id")
                    # Check if message_id exists (indicates email was sent)
                    elif response_data.get("message_id"):
                        message_id = response_data.get("message_id")
                        gmail_thread_id = response_data.get("gmail_thread_id") or response_data.get("thread_id")  # Support both for backward compatibility
                        if message_id:
                            is_success = True
                            if not gmail_thread_id:
                                logger.warning(f"⚠️ Webhook returned message_id but missing gmail_thread_id")
                    # If we get 200 but no message_id, the workflow needs to be fixed
                    else:
                        # Check if n8n returned an error
                        if response_data.get("success") == False:
                            error_msg = response_data.get("error", "Unknown error")
                            error_details = response_data.get("error_details") or response_data.get("details") or response_data.get("message", "")
                            logger.error(f"❌ n8n WORKFLOW ERROR: {error_msg}")
                            if error_details:
                                logger.error(f"❌ Error details: {error_details}")
                            logger.error(f"❌ Full n8n response: {response_data}")
                            logger.error(f"❌ This indicates the n8n workflow failed to send the email")
                            logger.error(f"❌ Check n8n workflow logs for Gmail API errors")
                            logger.error(f"❌ Verify Gmail node configuration uses: $json.gmail_thread_id and $json.message_id")
                        else:
                            logger.error(f"❌ Webhook returned 200 but missing required fields. Response: {response_data}")
                            logger.error(f"❌ n8n workflow MUST return message_id and gmail_thread_id from Gmail API response")
                            logger.error(f"❌ Expected format: {{'success': true, 'message_id': '...', 'gmail_thread_id': '...'}}")
                
                # Build webhook response with Gmail IDs if available
                webhook_response = {
                    "success": is_success,
                    "message": response_data.get("message", "Email sent via webhook" if is_success else "Email sending failed"),
                    "timestamp": response_data.get("timestamp")
                }
                
                if message_id:
                    webhook_response["message_id"] = message_id
                if gmail_thread_id:
                    webhook_response["gmail_thread_id"] = gmail_thread_id
                if not is_success:
                    webhook_response["error"] = response_data.get("error", "Unknown error")
                
                logger.info(f"📥 WEBHOOK RESPONSE PARSED: success={is_success}, message_id={message_id}, gmail_thread_id={gmail_thread_id}")
                
                return {
                    "success": is_success,
                    "webhook_response": webhook_response,
                    "status_code": response.status_code,
                    "message": webhook_response.get("message", "Email sent via webhook" if is_success else "Email sending failed")
                }
        
        except httpx.TimeoutException:
            error_msg = f"Webhook timeout after {self.timeout}s"
            logger.error(f"❌ WEBHOOK TIMEOUT: {error_msg} for {email_to}")
            logger.error(f"❌ WEBHOOK URL was: {webhook_url}")
            return {
                "success": False,
                "error": error_msg,
                "webhook_response": None,
                "status_code": None
            }
        
        except httpx.HTTPStatusError as e:
            error_msg = f"Webhook HTTP error {e.response.status_code}: {e.response.text}"
            logger.error(f"❌ WEBHOOK HTTP ERROR: {error_msg} for {email_to}")
            logger.error(f"❌ WEBHOOK URL was: {webhook_url}")
            logger.error(f"❌ Response status: {e.response.status_code}")
            logger.error(f"❌ Response text: {e.response.text[:500]}")
            # Try to parse error response
            try:
                error_response = e.response.json()
                logger.error(f"❌ Response JSON: {error_response}")
            except:
                error_response = {"message": e.response.text}
            
            return {
                "success": False,
                "error": error_msg,
                "webhook_response": error_response,  # Return error response as dict, not None
                "status_code": e.response.status_code
            }
        
        except Exception as e:
            error_msg = f"Webhook error: {str(e)}"
            logger.error(f"❌ WEBHOOK EXCEPTION: {error_msg} for {email_to}", exc_info=True)
            logger.error(f"❌ WEBHOOK URL was: {webhook_url}")
            return {
                "success": False,
                "error": error_msg,
                "webhook_response": None,
                "status_code": None
            }

