# Ticket 03 (optional stretch): AI summary for approvers

**From:** Head of Sales Operations
**Priority:** Low, nice to have

Approvers spend too long reading deal notes. We would like a short AI
generated summary on each deal that tells the approver what is being asked and
anything they should watch out for.

There is a stand in model client in `backend/src/ai/llmClient.ts` so you do not
need an API key. Do not worry about making it perfect. We care more about how
you would build it safely.

Be ready to explain:

- Where this logic should live and what the endpoint looks like
- What could go wrong if the model gets it wrong
- What you do with deal notes you cannot trust
- How you would know the summaries are any good before shipping
