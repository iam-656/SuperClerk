# Gmail Integration: Webhooks vs. Polling

When integrating with Gmail, there are two main strategies for keeping your local database in sync with a user's inbox: **Polling** and **Webhooks (Pub/Sub)**. SuperClerk will implement a combination of both for maximum reliability.

## 1. 15-Minute Polling + Manual Refresh

**How it works:** 
A background scheduler (like APScheduler) wakes up every 15 minutes, connects to the Gmail API for every user, and asks: *"Have there been any new emails since my last check?"*
Additionally, a "Refresh" button on the UI allows the user to manually trigger this check at any moment.

| Pros | Cons |
| :--- | :--- |
| **Simplicity:** Very easy to set up. No complex infrastructure needed. | **Latency:** Emails can be up to 15 minutes delayed before the system sees them. |
| **Localhost Friendly:** Works perfectly on your local machine without needing public URLs. | **Inefficiency:** Wastes API quota and server resources asking *"Any updates?"* when the answer is usually "No". |
| **Reliable:** Less moving parts means fewer points of failure. | **Scaling Issues:** As user count grows, polling thousands of accounts every 15 minutes becomes very expensive. |

## 2. Webhooks (Google Cloud Pub/Sub)

**How it works:** 
You tell Gmail to "watch" an inbox. When a new email arrives, Gmail instantly sends a message to a Google Cloud Pub/Sub Topic. That Topic then immediately fires an HTTP POST request (Push Notification) to your backend URL (`/api/v1/webhooks/gmail`). Your backend then knows exactly *when* to fetch new emails.

| Pros | Cons |
| :--- | :--- |
| **Instant:** Emails are processed by your AI seconds after they arrive. | **Complexity:** Requires setting up Google Cloud Pub/Sub infrastructure. |
| **Highly Efficient:** Your server does zero work until an email actually arrives. | **Requires HTTPS Endpoint:** Google *cannot* send webhooks to `localhost`. You need a public domain or a tunneling tool like `ngrok`. |
| **Scalable:** The standard for production apps handling thousands of users. | **Token Expiry:** You must re-call the `watch()` endpoint every 7 days to keep the webhook alive. |

---

# Setting up Google Cloud Pub/Sub for Webhooks

## 3. Webhooks (Push) vs Pub/Sub Pull (Recommended)

When using Google Cloud Pub/Sub, you have two ways to receive the messages: **Push** and **Pull**.

### Option A: Push (Webhooks)
Pub/Sub makes an HTTP POST request to your FastAPI server (`/api/v1/webhooks/gmail`).
- **Pros:** Completely serverless. Cloud Run handles it natively.
- **Cons:** Requires a public HTTPS URL (like `ngrok` for localhost). If your AI takes too long to process the email (e.g., > 10 seconds), Google assumes the webhook failed and retries, which can cause duplicate AI processing.

### Option B: Pull (The "Python Script" approach)
Your FastAPI server (or a separate worker script) runs a background loop using the `google-cloud-pubsub` SDK that constantly connects to Google and says "Give me the latest messages".
- **Pros:** No `ngrok` needed. Works perfectly on localhost. **Built-in backpressure:** Your AI can take 2 minutes to process an email; you just hold the message and `ack()` (acknowledge) it when the AI is done.
- **Cons:** Requires a long-running process (a background thread in FastAPI or a separate worker script).

**Verdict:** Your suggestion is **practically better**. Using a Pull Subscription locally while building the AI logic is exactly the right approach. It avoids `ngrok` headaches and prevents webhook timeouts while the AI is "thinking".

---

# Setting up Google Cloud Pub/Sub (Pull Method)

## Step 1: Enable APIs
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Select your SuperClerk project.
3. Enable both the **Pub/Sub API** and the **Gmail API**.

## Step 2: Create a Pub/Sub Topic
1. Go to the [Pub/Sub Topics page](https://console.cloud.google.com/cloudpubsub/topic/list).
2. Click **+ CREATE TOPIC**.
3. Topic ID: `gmail-webhook-topic`
4. Uncheck "Add a default subscription".
5. Click **CREATE**.

## Step 3: Grant Gmail Permission to Publish
Gmail needs permission to send messages to the topic you just created.
1. On the Topic details page, look at the right side for the **Permissions** panel (or click "SHOW INFO PANEL").
2. Click **ADD PRINCIPAL**.
3. In "New principals", enter exactly: `gmail-api-push@system.gserviceaccount.com`
4. In "Select a role", choose **Pub/Sub Publisher**.
5. Click **SAVE**.

## Step 4: Create a Pull Subscription
This subscription holds the messages for your local Python script to grab.
1. Still on the Topic details page, click **+ CREATE SUBSCRIPTION** at the top.
2. Subscription ID: `gmail-pull-sub`
3. Delivery Type: Select **Pull**.
4. Scroll down and click **CREATE**.

## Step 5: Update Your Backend Environment Variables
You need the full names to put into your `.env` file so the backend knows where to listen.

Add these to your `backend/.env`:
```env
# Tell Gmail to send notifications here
GOOGLE_PUBSUB_TOPIC="projects/YOUR-GOOGLE-PROJECT-ID/topics/gmail-webhook-topic"

# Tell our local Python worker to pull messages from here
GOOGLE_PUBSUB_SUBSCRIPTION="projects/YOUR-GOOGLE-PROJECT-ID/subscriptions/gmail-pull-sub"

# Ensure you have your Google Cloud credentials JSON file set up for local auth:
# GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/service-account-key.json"
```

## Step 6: Get Your Service Account Key (JSON)
To allow your local Python script to connect to Google Cloud and pull messages, it needs to authenticate. It does this using a Service Account Key file.

1. Go to the [Service Accounts page](https://console.cloud.google.com/iam-admin/serviceaccounts) in the Google Cloud Console.
2. Click **+ CREATE SERVICE ACCOUNT** at the top.
3. Service account name: `superclerk-local-dev` (or similar). Click **CREATE AND CONTINUE**.
4. Grant this service account access to project:
   - Select the role **Pub/Sub Subscriber** (this allows it to pull messages).
   - Click **CONTINUE**, then **DONE**.
5. You will now see your new service account in the list. Click the **three vertical dots** on the right side of its row and select **Manage keys**.
6. Click **ADD KEY** -> **Create new key**.
7. Choose **JSON** and click **CREATE**.
8. The `.json` file will automatically download to your computer.
9. Move this file into a secure location (e.g., the root of your `backend` folder) and rename it to `service-account-key.json`.
   > **CRITICAL:** Ensure this file is added to your `.gitignore`! Never commit this file to GitHub.

Update your `backend/.env` file to point to the absolute path of this downloaded JSON file:
```env
GOOGLE_APPLICATION_CREDENTIALS="E:\SuperClerk(2)\backend\service-account-key.json"
```

---

*With this setup, we will create a background worker in FastAPI that constantly pulls from `gmail-pull-sub`. When Gmail pushes an event to `gmail-webhook-topic`, it waits in the queue until our local app grabs it, processes it with AI, and acknowledges it.*

---

*You are now ready to receive real-time push notifications from Gmail! When we implement Phase 5, the backend will call `gmail.users().watch()` to link individual users' inboxes to this topic.*
