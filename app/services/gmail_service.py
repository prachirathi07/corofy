from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import base64
import json
from typing import Dict, Any, Optional
from app.core.config import settings
import logging
import os

logger = logging.getLogger(__name__)

# Gmail API scopes
SCOPES = ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.readonly']

class GmailService:
    """
    Service for sending emails via Gmail API
    """
    
    def __init__(self):
        self.client_id = settings.GMAIL_CLIENT_ID
        self.client_secret = settings.GMAIL_CLIENT_SECRET
        self.refresh_token = settings.GMAIL_REFRESH_TOKEN
        self.user_email = settings.GMAIL_USER_EMAIL
        
        if not all([self.client_id, self.client_secret, self.refresh_token, self.user_email]):
            raise ValueError("Gmail credentials are required. Please add GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, and GMAIL_USER_EMAIL to your .env file.")
        
        self.service = self._build_service()
    
    def _build_service(self):
        """Build Gmail API service with OAuth credentials"""
        try:
            creds = Credentials(
                token=None,
                refresh_token=self.refresh_token,
                token_uri="https://oauth2.googleapis.com/token",
                client_id=self.client_id,
                client_secret=self.client_secret
            )
            
            # Refresh the token if needed
            if creds.expired:
                creds.refresh(Request())
            
            service = build('gmail', 'v1', credentials=creds)
            return service
        
        except Exception as e:
            from app.utils.error_handler import format_error_response
            error_info = format_error_response(e, "Gmail", None, str(e))
            logger.error(f"Failed to build Gmail service: {error_info['technical_message']}")
            raise Exception(f"Gmail authentication failed: {error_info['user_message']}")
    
    def send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        reply_to: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send an email via Gmail API
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            body: Email body (plain text or HTML)
            reply_to: Reply-to email (optional)
        
        Returns:
            Dict with message_id, thread_id, and status
        """
        try:
            # Create message
            message = MIMEMultipart('alternative')
            message['to'] = to_email
            message['from'] = self.user_email
            message['subject'] = subject
            
            if reply_to:
                message['reply-to'] = reply_to
            
            # Add body (as plain text)
            text_part = MIMEText(body, 'plain')
            message.attach(text_part)
            
            # Encode message
            raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
            
            # Send email
            send_message = self.service.users().messages().send(
                userId='me',
                body={'raw': raw_message}
            ).execute()
            
            message_id = send_message.get('id')
            thread_id = send_message.get('threadId')
            
            logger.info(f"Email sent successfully to {to_email}. Message ID: {message_id}")
            
            return {
                "success": True,
                "message_id": message_id,
                "thread_id": thread_id,
                "to_email": to_email,
                "subject": subject
            }
        
        except Exception as e:
            from app.utils.error_handler import format_error_response
            
            # Get status code if available (from Google API errors)
            status_code = None
            error_text = str(e)
            if hasattr(e, 'status_code'):
                status_code = e.status_code
            elif hasattr(e, 'resp') and hasattr(e.resp, 'status'):
                status_code = e.resp.status
            
            error_info = format_error_response(e, "Gmail", status_code, error_text)
            logger.error(f"Error sending email to {to_email}: {error_info['technical_message']}", exc_info=True)
            
            return {
                "success": False,
                "error": error_info["error"],
                "error_type": error_info["error_type"],
                "message_id": None,
                "thread_id": None,
                "status_code": error_info.get("status_code")
            }
    
    def get_message(self, message_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a Gmail message by ID
        
        Args:
            message_id: Gmail message ID
        
        Returns:
            Dict with message details or None
        """
        try:
            message = self.service.users().messages().get(
                userId='me',
                id=message_id,
                format='full'
            ).execute()
            
            return message
        
        except Exception as e:
            from app.utils.error_handler import format_error_response
            
            status_code = None
            if hasattr(e, 'status_code'):
                status_code = e.status_code
            elif hasattr(e, 'resp') and hasattr(e.resp, 'status'):
                status_code = e.resp.status
            
            error_info = format_error_response(e, "Gmail", status_code, str(e))
            logger.error(f"Error getting message {message_id}: {error_info['technical_message']}")
            return None
    
    def get_thread_messages(self, thread_id: str) -> list:
        """
        Get all messages in a thread
        
        Args:
            thread_id: Gmail thread ID
        
        Returns:
            List of messages in the thread
        """
        try:
            thread = self.service.users().threads().get(
                userId='me',
                id=thread_id,
                format='full'
            ).execute()
            
            messages = thread.get('messages', [])
            return messages
        
        except Exception as e:
            from app.utils.error_handler import format_error_response
            
            status_code = None
            if hasattr(e, 'status_code'):
                status_code = e.status_code
            elif hasattr(e, 'resp') and hasattr(e.resp, 'status'):
                status_code = e.resp.status
            
            error_info = format_error_response(e, "Gmail", status_code, str(e))
            logger.error(f"Error getting thread {thread_id}: {error_info['technical_message']}")
            return []

