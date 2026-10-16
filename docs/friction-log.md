# Friction log

One entry per problem that cost more than 15 minutes with an Amazon tool or doc.

## 2026-10-16 AWS account: Bedrock blocked while the account is verified
- What I was doing: setting up the IAM user and `aws configure --profile pip` to call Nova 2 Lite for Ask Pip.
- What I tried (commands, links): the AWS console checklist for a new account on the Free plan.
- What happened (exact error): the account, created on October 16 (day two of the build), was still waiting for verification that day, so there was no AWS profile on the Mac and no Bedrock call could be made.
- What I expected: to call Nova within the first hour, as planned for Step 2.
- Time lost: Ask Pip could not use Nova yet (update this when the account works); no build time was lost, because we switched the server to a local model behind the same interface (`AI_PROVIDER=ollama`, PROJECT.md 2.4).
- Workaround: the local brain and the answer memory; Nova replaces the local model with one setting once the account works.
- Suggestion for Amazon: show verification status and an expected time in the console, and say which services a Free plan account can use before it is verified.
