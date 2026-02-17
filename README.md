<p align="center"><code>npm i -g langtrain</code></p>
<p align="center"><strong>Langtrain CLI</strong> is a unified AI engineering platform that runs locally on your computer and connects to the Langtrain Cloud.
<br/>
<p align="center">
If you want Langtrain in your code editor, <a href="https://langtrain.ai/docs/vscode">install the VS Code Extension.</a>
<br/>If you are looking for the <em>web-based platform</em>, <strong>Langtrain Web</strong>, go to <a href="https://langtrain.ai">langtrain.ai</a>.
</p>

---

## Quickstart

### Installing and running Langtrain CLI

Install globally with npm:

```shell
# Install using npm
npm install -g langtrain
```

Then simply run `langtrain` to get started with the interactive menu.

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

You can check your current subscription status and limits directly from the CLI:

```shell
langtrain status
```

*Free plans allow local fine-tuning and limited cloud agent interactions. Upgrade to Pro for cloud-based GPU training.*

## Features

- **🤖 AI Agents**: Create, manage, and chat with custom AI agents hosted on Langtrain Server.
- **🧠 Langtune**: Fine-tune LLMs (Llama 3, Mistral) locally or on the cloud.
- **👁️ Langvision**: Optimize and fine-tune multimodal vision models.
- **☁️ Data Persistence**: Automatically sync datasets and training jobs with your workspace.

## Docs

- [**Langtrain Documentation**](https://docs.langtrain.ai)
- [**SDK Reference**](https://docs.langtrain.ai/sdk)
- [**Contributing**](./CONTRIBUTING.md)

This repository is licensed under the [MIT License](LICENSE).
