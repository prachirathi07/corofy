# Corofy Lead Scraping & Email Automation System - Mermaid Diagram

```mermaid
graph TB
    %% External Entities
    User[👤 User]
    ApolloAPI[🔍 Apollo API]
    ApifyAPI[🔍 Apify API]
    FirecrawlAPI[🌐 Firecrawl API]
    OpenAIAPI[🤖 OpenAI API]
    GmailAPI[📧 Gmail API]
    N8NWebhook[⚡ n8n Webhook]

    %% Data Stores
    D1[(D1: apollo_searches)]
    D2[(D2: leads)]
    D3[(D3: company_websites)]
    D4[(D4: email_campaigns)]
    D5[(D5: email_queue)]
    D6[(D6: emails_sent)]
    D7[(D7: email_replies)]
    D8[(D8: follow_ups)]

    %% Process 1: Lead Scraping
    subgraph P1["PROCESS 1: LEAD SCRAPING"]
        P1_1[1.1 Create Search]
        P1_2[1.2 Scrape Leads]
        P1_3[1.3 Update Status]
    end

    %% Process 2: Email Sending
    subgraph P2["PROCESS 2: EMAIL SENDING"]
        P2_1[2.1 Get Leads]
        P2_2[2.2 Check Timezone]
        P2_3[2.3 Scrape Website]
        P2_4[2.4 Generate Email]
        P2_5{2.5 Business<br/>Hours?}
        P2_6[2.6 Send Immediately]
        P2_7[2.7 Queue Email]
        P2_8[2.8 Schedule Follow-ups]
    end

    %% Process 3: Email Queue Processing
    subgraph P3["PROCESS 3: EMAIL QUEUE (Every 3 Hours)"]
        P3_1[3.1 Get Queued Emails]
        P3_2[3.2 Check Scheduled Time]
        P3_3[3.3 Check Timezone]
        P3_4{3.4 Ready &<br/>Business Hours?}
        P3_5[3.5 Send Email]
        P3_6[3.6 Keep in Queue]
    end

    %% Process 4: Follow-up Processing
    subgraph P4["PROCESS 4: FOLLOW-UPS (Every 3 Hours)"]
        P4_1[4.1 Get Due Follow-ups]
        P4_2[4.2 Check if Replied]
        P4_3{4.3 Has<br/>Replied?}
        P4_4[4.4 Cancel Follow-up]
        P4_5[4.5 Check Timezone]
        P4_6{4.6 Business<br/>Hours?}
        P4_7[4.7 Send Follow-up]
        P4_8[4.8 Keep Pending]
    end

    %% Process 5: Reply Checking
    subgraph P5["PROCESS 5: REPLY CHECKING (Every 2 Hours)"]
        P5_1[5.1 Get Sent Emails]
        P5_2[5.2 Check Gmail Thread]
        P5_3{5.3 New Reply<br/>Found?}
        P5_4[5.4 Analyze Reply]
        P5_5[5.5 Store Reply]
        P5_6[5.6 Cancel Follow-ups]
        P5_7[5.7 Update Lead Status]
    end

    %% User Actions
    User -->|Search Criteria| P1_1
    User -->|Select Leads| P2_1

    %% Process 1 Flow
    P1_1 -->|Create| D1
    P1_1 --> P1_2
    ApolloAPI -->|Lead Data| P1_2
    ApifyAPI -->|Lead Data| P1_2
    P1_2 -->|Create| D2
    P1_2 --> P1_3
    P1_3 -->|Update| D1

    %% Process 2 Flow
    D2 -->|Read| P2_1
    P2_1 --> P2_2
    P2_2 --> P2_3
    D3 -->|Check Cache| P2_3
    FirecrawlAPI -->|Website Content| P2_3
    P2_3 -->|Update/Create| D3
    P2_3 --> P2_4
    OpenAIAPI -->|Email Content| P2_4
    P2_4 --> P2_5
    P2_5 -->|YES| P2_6
    P2_5 -->|NO| P2_7
    N8NWebhook -->|Send Email| P2_6
    P2_6 -->|Create| D6
    P2_7 -->|Create| D5
    P2_6 --> P2_8
    P2_7 --> P2_8
    P2_8 -->|Create| D8

    %% Process 3 Flow
    D5 -->|Read| P3_1
    P3_1 --> P3_2
    P3_2 --> P3_3
    D2 -->|Read Country| P3_3
    P3_3 --> P3_4
    P3_4 -->|YES| P3_5
    P3_4 -->|NO| P3_6
    N8NWebhook -->|Send Email| P3_5
    P3_5 -->|Update| D5
    P3_5 -->|Create| D6
    P3_6 -->|Keep Pending| D5

    %% Process 4 Flow
    D8 -->|Read| P4_1
    P4_1 --> P4_2
    D7 -->|Check Replies| P4_2
    P4_2 --> P4_3
    P4_3 -->|YES| P4_4
    P4_3 -->|NO| P4_5
    P4_4 -->|Update| D8
    D2 -->|Read Country| P4_5
    P4_5 --> P4_6
    P4_6 -->|YES| P4_7
    P4_6 -->|NO| P4_8
    OpenAIAPI -->|Generate Follow-up| P4_7
    N8NWebhook -->|Send Email| P4_7
    P4_7 -->|Update| D8
    P4_7 -->|Create| D6
    P4_8 -->|Keep Pending| D8

    %% Process 5 Flow
    D6 -->|Read Thread IDs| P5_1
    P5_1 --> P5_2
    GmailAPI -->|Check Thread| P5_2
    P5_2 --> P5_3
    P5_3 -->|YES| P5_4
    P5_3 -->|NO| P5_1
    OpenAIAPI -->|Analyze Reply| P5_4
    P5_4 --> P5_5
    P5_5 -->|Create| D7
    P5_5 --> P5_6
    P5_6 -->|Update| D8
    P5_6 --> P5_7
    P5_7 -->|Update| D2

    %% Styling
    classDef processBox fill:#e1f5ff,stroke:#01579b,stroke-width:2px
    classDef dataStore fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef decision fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef external fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px

    class P1_1,P1_2,P1_3,P2_1,P2_2,P2_3,P2_4,P2_6,P2_7,P2_8,P3_1,P3_2,P3_3,P3_5,P3_6,P4_1,P4_2,P4_4,P4_5,P4_7,P4_8,P5_1,P5_2,P5_4,P5_5,P5_6,P5_7 processBox
    class D1,D2,D3,D4,D5,D6,D7,D8 dataStore
    class P2_5,P3_4,P4_3,P4_6,P5_3 decision
    class User,ApolloAPI,ApifyAPI,FirecrawlAPI,OpenAIAPI,GmailAPI,N8NWebhook external
```

## Complete System Flow

### Process 1: Lead Scraping
- User creates search → Stores in `apollo_searches`
- Scrapes leads from Apollo/Apify → Stores in `leads`
- Updates search status

### Process 2: Email Sending
- Gets selected leads
- Checks timezone (business hours?)
- Scrapes website (cached or via Firecrawl)
- Generates email using OpenAI
- **Decision**: Business hours?
  - **YES** → Send immediately → Store in `emails_sent`
  - **NO** → Queue email → Store in `email_queue`
- Schedules follow-ups (5day, 10day) → Store in `follow_ups`

### Process 3: Email Queue Processing (Every 3 Hours)
- Gets pending emails from queue
- Checks scheduled time
- Checks timezone
- **Decision**: Ready & Business hours?
  - **YES** → Send email → Update queue, Store in `emails_sent`
  - **NO** → Keep in queue

### Process 4: Follow-up Processing (Every 3 Hours)
- Gets due follow-ups
- Checks if lead replied
- **Decision**: Has replied?
  - **YES** → Cancel follow-up
  - **NO** → Check timezone
    - **Decision**: Business hours?
      - **YES** → Send follow-up → Update status, Store in `emails_sent`
      - **NO** → Keep pending

### Process 5: Reply Checking (Every 2 Hours)
- Gets sent emails with thread IDs
- Checks Gmail API for new replies
- **Decision**: New reply found?
  - **YES** → Analyze reply (OpenAI) → Store in `email_replies` → Cancel follow-ups → Update lead status
  - **NO** → Continue checking

## Data Stores
- **D1**: `apollo_searches` - Search criteria
- **D2**: `leads` - All scraped leads
- **D3**: `company_websites` - Cached website content
- **D4**: `email_campaigns` - Campaign metadata
- **D5**: `email_queue` - Queued emails
- **D6**: `emails_sent` - All sent emails
- **D7**: `email_replies` - Detected replies
- **D8**: `follow_ups` - Scheduled follow-ups

## External Services
- **Apollo API** / **Apify API** - Lead scraping
- **Firecrawl API** - Website scraping
- **OpenAI API** - Email generation & reply analysis
- **Gmail API** - Reply detection
- **n8n Webhook** - Email sending (via Gmail API)

