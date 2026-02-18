<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/langtrain-ai/langtrain-sdk/main/public/langtrain-white.svg">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/langtrain-ai/langtrain-sdk/main/public/langtrain-black.svg">
    <img alt="Langtrain Logo" src="https://raw.githubusercontent.com/langtrain-ai/langtrain-sdk/main/public/langtrain-black.svg" width="250">
  </picture>
  <h3>Langtrain SDK</h3>
  <p>The unified intelligence layer for JavaScript applications.</p>
  
  <p>
    <a href="https://www.npmjs.com/package/langtrain"><img src="https://img.shields.io/npm/v/langtrain?style=flat-square&labelColor=18181b&color=22c55e" alt="npm version" /></a>
    <a href="https://www.npmjs.com/package/langtrain"><img src="https://img.shields.io/npm/dm/langtrain?style=flat-square&labelColor=18181b&color=3b82f6" alt="npm downloads" /></a>
    <a href="https://langtrain.ai"><img src="https://img.shields.io/badge/website-langtrain.ai-18181b?style=flat-square&labelColor=18181b" alt="website" /></a>
    <a href="https://docs.langtrain.ai"><img src="https://img.shields.io/badge/docs-documentation-18181b?style=flat-square&labelColor=18181b" alt="documentation" /></a>
    <a href="https://github.com/langtrain-ai/langtrain-sdk/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/langtrain?style=flat-square&labelColor=18181b&color=3b82f6" alt="license" /></a>
  </p>

  <br/>

  <p align="center"><code>npm i -g langtrain</code></p>
  <p><strong>Langtrain CLI</strong> is a unified AI engineering platform that runs locally on your computer and connects to the Langtrain Cloud.</p>

  <p>
    If you want Langtrain in your code editor, <a href="https://langtrain.ai/docs/vscode">install the VS Code Extension.</a><br/>
    If you are looking for the <em>web-based platform</em>, <strong>Langtrain Web</strong>, go to <a href="https://langtrain.ai">langtrain.ai</a>.
  </p>
</div>

---

## Quickstart (CLI)

Install globally with npm:

```shell
npm install -g langtrain
```

Then run `langtrain` to start the interactive AI engineering studio:

```shell
langtrain
```

<details>
<summary><strong>Troubleshooting Installation</strong></summary>

If you encounter permission errors, try running with sudo or fix your npm permissions:
```bash
sudo npm install -g langtrain
```
</details>

### Using Langtrain with your Cloud Plan

Run `langtrain login` and enter your API Key from the dashboard to authenticate. We recommend signing into your Langtrain account to use **Cloud Finetuning**, **Agent Persistence**, and **Model Hosting** as part of your Pro or Enterprise plan. [Learn more about Langtrain Plans](https://langtrain.ai/pricing).

Check your subscription status and limits:
```shell
langtrain status
```
*Free plans allow local fine-tuning. Upgrade to Pro for cloud-based GPU training.*

---

## SDK Usage

You can also use `langtrain` as a library in your Node.js applications to build intelligent agents and workflows.

```typescript
import { Langvision, Langtune, SubscriptionClient } from 'langtrain';

// 1. Initialize Clients
const vision = new Langvision({ apiKey: process.env.LANGTRAIN_API_KEY });
const tune = new Langtune({ apiKey: process.env.LANGTRAIN_API_KEY });

async function analyzeAndTune() {
  // Analyze visual user context
  const context = await vision.analyze({
    image: './dashboard.jpg',
    features: ['layout', 'text'] 
  });

  console.log('Visual Context:', context);

  // Generate optimized response
  const response = await tune.generate({
    model: 'gpt-4-vision-optimized',
    prompt: `Explain this dashboard layout: ${context.description}`
  });
  
  console.log(response);
}
```

## Features

- **AI Agents**: Create, manage, and chat with custom AI agents hosted on Langtrain Server.
- **Langtune**: Fine-tune LLMs (Llama 3, Mistral) locally or on the cloud.
- **Langvision**: Optimize and fine-tune multimodal vision models.
- **Data Persistence**: Automatically sync datasets and training jobs with your workspace.
- **Subscription Management**: Verify plan limits and feature access programmatically.

## Configuration

The SDK and CLI can be configured using environment variables `(dotenv supported)` or via `langtrain login`.

| Variable | Description |
| :--- | :--- |
| `LANGTRAIN_API_KEY` | Your project API Key (get it from the dashboard). |
| `LANGTRAIN_WORKSPACE_ID` | (Optional) Workspace ID for specific environment interaction. |

```typescript
// Example: Manually passing config
const client = new Langvision({
  apiKey: "lt_sk_...",
  workspaceId: "ws_..."
});
```

## Community & Support

- **[GitHub Discussions](https://github.com/langtrain-ai/langtrain-sdk/discussions)**: Ask questions and share ideas.
- **[Twitter](https://twitter.com/langtrain_ai)**: Follow for updates and announcements.
- **[Email](mailto:support@langtrain.ai)**: Contact us for enterprise support.

## Documentation

- [**Langtrain Documentation**](https://docs.langtrain.ai)
- [**SDK Reference**](https://docs.langtrain.ai/sdk)
- [**Contributing**](./CONTRIBUTING.md)

## License

This repository is licensed under the [MIT License](LICENSE).
copyright © [Langtrain](https://langtrain.xyz)
