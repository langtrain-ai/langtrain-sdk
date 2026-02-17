<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/langtrain-ai/langtrain-sdk/main/public/langtrain-white.svg">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/langtrain-ai/langtrain-sdk/main/public/langtrain-black.svg">
    <img alt="Langtrain Logo" src="https://raw.githubusercontent.com/langtrain-ai/langtrain-sdk/main/public/langtrain-black.svg" width="250">
  </picture>
  <h1>Langtrain SDK</h1>
  <p>
    The unified intelligence layer for JavaScript applications. <br/>
    Combine computer vision and LLM fine-tuning in a single, high-performance SDK.
  </p>
  
  <p>
    <a href="https://www.npmjs.com/package/langtrain"><img src="https://img.shields.io/npm/v/langtrain?style=flat-square&labelColor=231f20&color=000000" alt="npm version" /></a>
    <a href="https://langtrain.ai"><img src="https://img.shields.io/badge/website-langtrain.ai-000000?style=flat-square&labelColor=231f20" alt="website" /></a>
    <a href="https://docs.langtrain.ai"><img src="https://img.shields.io/badge/docs-documentation-000000?style=flat-square&labelColor=231f20" alt="documentation" /></a>
    <a href="https://github.com/langtrain-ai/langtrain-sdk/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/langtrain?style=flat-square&labelColor=231f20&color=000000" alt="license" /></a>
  </p>

  <br/>

  <pre>npm install langtrain</pre>

  <br/>
</div>

## Overview

Langtrain brings the power of **Langvision** (Computer Vision) and **Langtune** (LLM Optimization) into your JavaScript/TypeScript workflow. It is designed to be the only SDK you need to build intelligent, multimodal AI applications.

## Key Features

| Feature | Description |
| :--- | :--- |
| **👁️ Computer Vision** | Advanced image analysis, object detection, and visual reasoning powered by `Langvision`. |
| **🧠 LLM Optimization** | Fine-tune and optimize language models effortlessly with `Langtune`. |
| **📦 Unified & Bundled** | A single dependency for your entire AI stack. Zero configuration required. |
| **⚡ Type-Safe** | Built with TypeScript for a robust, developer-friendly experience. |

## Quick Start

```typescript
import { Langvision, Langtune } from 'langtrain';

// 1. Initialize Clients
const vision = new Langvision({ apiKey: process.env.LANGVISION_API_KEY });
const tune = new Langtune({ apiKey: process.env.LANGTUNE_API_KEY });

// 2. Build Intelligence
async function analyzeAndTune() {
  try {
    // Analyze visual user context
    const context = await vision.analyze({
      image: 'https://example.com/dashboard.jpg',
      features: ['layout', 'text'] 
    });

    console.log('Visual Context:', context);

    // Generate optimized response based on visual context
    const response = await tune.generate({
      model: 'gpt-4-vision-optimized',
      prompt: `Explain this dashboard layout: ${context.description}`
    });

    console.log('AI Response:', response);
  } catch (error) {
    console.error('Error processing AI request:', error);
  }
}

analyzeAndTune();
```

## Advanced Usage

For more complex workflows, you can leverage specific modules:

### Fine-Tuning a Model

```typescript
// Start a fine-tuning job
const job = await tune.createFineTune({
  trainingFile: 'file-id-123',
  model: 'gpt-3.5-turbo',
  hyperparameters: {
    nEpochs: 4
  }
});

console.log(`Fine-tuning started: ${job.id}`);
```

## Documentation

Visit [docs.langtrain.ai](https://docs.langtrain.ai) for comprehensive guides and API reference.

## License

MIT © [Langtrain AI](https://langtrain.ai)
