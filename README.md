<div align="center">
  <img src="https://raw.githubusercontent.com/langtrain-ai/langtrain-sdk/main/logo.svg" alt="Langtrain Logo" width="120" height="auto" />
  <h1>Langtrain SDK</h1>
  <p>
    The unified intelligence layer for JavaScript applications. <br/>
    Combine computer vision and LLM fine-tuning in a single, high-performance SDK.
  </p>
  
  <p>
    <a href="https://www.npmjs.com/package/langtrain"><img src="https://img.shields.io/npm/v/langtrain?style=flat-square&labelColor=231f20&color=000000" alt="npm version" /></a>
    <a href="https://langtrain.ai"><img src="https://img.shields.io/badge/website-langtrain.ai-000000?style=flat-square&labelColor=231f20" alt="website" /></a>
    <a href="https://docs.langtrain.ai"><img src="https://img.shields.io/badge/docs-documentation-000000?style=flat-square&labelColor=231f20" alt="documentation" /></a>
  </p>

  <br/>

  <pre>npm install langtrain</pre>

  <br/>
</div>

## Overview

Langtrain brings the power of **Langvision** (Computer Vision) and **Langtune** (LLM Optimization) into your JavaScript/TypeScript workflow. It is designed to be the only SDK you need to build intelligent, multimodal AI applications.

## Features

- **Computer Vision**: Advanced image analysis, object detection, and visual reasoning.
- **LLM Optimization**: Fine-tune and optimize language models effortlessly.
- **Zero-Config Bundling**: Everything is included. No peer dependencies to manage.
- **Type-Safe**: Written in TypeScript for a robust development experience.

## Usage

```typescript
import { Langvision, Langtune } from 'langtrain';

// 1. Initialize Clients
const vision = new Langvision({ apiKey: process.env.LANGVISION_API_KEY });
const tune = new Langtune({ apiKey: process.env.LANGTUNE_API_KEY });

// 2. Build Intelligence
async function analyzeAndTune() {
  // Analyze visual user context
  const context = await vision.analyze({
    image: 'https://example.com/dashboard.jpg',
    features: ['layout', 'text'] 
  });

  // Generate optimized response based on visual context
  const response = await tune.generate({
    model: 'gpt-4-vision-optimized',
    prompt: `Explain this dashboard layout: ${context.description}`
  });

  console.log(response);
}
```

## Documentation

Visit [docs.langtrain.ai](https://docs.langtrain.ai) for comprehensive guides and API reference.

## License

MIT © [Langtrain AI](https://langtrain.ai)
