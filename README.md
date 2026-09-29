# Customer Inbox Triage App

## Overview

The Customer Inbox Triage app is a lightweight AI-powered tool that helps classify customer support messages and recommend actions. It uses Groq AI to categorize messages, applies rule-based urgency scoring, and suggests next steps based on predefined templates.

## Problem Statement

Support teams waste time manually reading and triaging customer messages. This tool provides an automated first pass at classification to help prioritize and route messages more efficiently.

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **AI**: Groq API (Llama 3.3 70B - Free tier)
- **Runtime**: Browser-based (local development only)

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Groq API key (FREE - get from https://console.groq.com)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd "L2 assessment"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Groq API Key**
   
   Create a `.env.local` file in the root directory:
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and add your Groq API key:
   ```
   VITE_GROQ_API_KEY=gsk_your-actual-key-here
   ```
   
   Get your FREE API key from: https://console.groq.com/keys
   
   **Why Groq?** Groq offers a generous free tier with fast inference and no credit card required!

4. **Run the application**
   ```bash
   npm run dev
   ```
   
   The app will be available at `http://localhost:5173`

## How It Works

1. **Paste Message**: User pastes a customer support message into the text area
2. **Analyze**: Click "Analyze Message" to process the input
3. **Classification and triage**: The app produces three results:
   - **Category Classification**: Uses Groq AI (Llama 3.3 70B) when available, or local rules when it is unavailable
   - **Urgency Scoring** (Rule-based): Scores configured phrases in the context of the message
   - **Recommendation** (Template-based): Uses category, urgency, and access problems to suggest an action
4. **Display Results**: Shows category, urgency tag, recommended action, and an explanation labeled with its source
5. **History**: All analyses are saved to localStorage and viewable in the History tab

## Local Category Fallback

When the Groq key is missing or the request fails, local rules classify clear billing problems, technical problems, and feature requests. Information questions without a reported problem become General Inquiry. Messages with multiple possible categories, uncertain reports, or no clear category become Needs Review, with a manual review recommendation. Denied and resolved problems are not treated as active issues. Local results carry a "Local fallback" source label and show a "Local Rule Explanation" so they are not mistaken for AI output. Older saved results retain their original category and explanation, with an unknown source label.

The seed phrases and context words are in `src/data/categoryRules.json`; the matching logic is in `src/utils/categoryFallback.js`. The "Atlas workspace" entry is an illustrative company term to replace with a real product name. Editing the seed file changes future analyses after the app rebuilds; this demo does not yet have a shared rule database or an in-app rule editor. The fallback is conservative phrase matching, not full language understanding, so a person should review uncertain results.

## Urgency Rules

The urgency scorer starts at **0 points**. The default phrases, point values, thresholds, and context words are in `src/data/urgencyRules.json`. The scoring logic is in `src/utils/urgencyScorer.js`. A company can add its own phrases or change point values in the data file without changing the scoring logic. A `phraseGroups` entry combines subjects, optional linking words, and states, so one data entry covers phrases such as "server down" and "database is unavailable."

- Critical signals such as an outage or lost account access are worth 3 points; the default High threshold is 3.
- Billing and technical problems are worth 1 point each; the default Medium threshold is 1. Repeated mentions of one signal count once.
- A matched phrase is ignored when nearby wording denies it ("no outage") or says it was resolved. Questions and uncertain claims such as "Is there an outage?" are held for review rather than treated as confirmed incidents.
- Some negative wording describes a real failure: "no access" and "not working" remain active problem signals.
- At 0 points, clear routine messages and denied or resolved problems are Low. Unclear messages are Medium for review. Zero means no urgency evidence was detected, not proof that no problem exists.

When changing the rule data, add representative positive, negative, resolved, and mixed-message examples to `src/utils/urgencyScorer.test.js` and run `node --test src/utils/urgencyScorer.test.js`. Phrase matching is a small, explainable fallback; it will not understand every wording or subtle context, so uncertain messages still need human review.


## Example Test Messages

Try analyzing these messages to see how the triage system works:

### Example 1: Production Issue
```
Our production server is down
```

### Example 2: Customer Feedback
```
Hi there! I just wanted to say thank you for your amazing customer service. I've been using your product for three years now and I'm really happy with it. Keep up the great work!
```

### Example 3: Feature Request
```
I would love to see a dark mode option in the app. It would be much easier on my eyes during night time usage.
```

### Example 4: Payment Issue
```
I tried to update my payment method but the page keeps loading forever. Is this a known issue?
```

### Example 5: Billing Question
```
Can I upgrade my subscription to the pro plan?
```

### Example 6: Technical Support
```
The dashboard won't load when I try to access it. I've tried refreshing but it keeps timing out.
```

## Security Note

⚠️ **Warning**: This application exposes the Groq API key in the browser (using `dangerouslyAllowBrowser: true`). This is acceptable for local development only but should **NEVER** be done in production. In a real application, API calls should be made from a secure backend server.

## Why Groq?

- ✅ **Completely Free** - No credit card required
- ✅ **Fast Inference** - Groq's LPU technology is incredibly fast
- ✅ **Generous Limits** - ~14,400 requests/day on free tier
- ✅ **High Quality** - Llama 3.3 70B performs excellently
- ✅ **Easy Signup** - Get started in minutes at https://console.groq.com

## License

This project is for educational purposes only.
