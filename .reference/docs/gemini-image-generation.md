# Gemini API Image Generation Notes

## Models Available
- **gemini-2.5-flash-image**: Fast, efficient for high-volume tasks
- **gemini-3-pro-image-preview**: Professional quality, supports up to 14 reference images

## JavaScript SDK Usage

```javascript
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";

async function main() {
  const ai = new GoogleGenAI({});
  
  // Read image and convert to base64
  const imagePath = "path/to/cat_image.png";
  const imageData = fs.readFileSync(imagePath);
  const base64Image = imageData.toString("base64");
  
  const prompt = [
    { text: "Create a picture of my cat eating a nano-banana in a " +
            "fancy restaurant under the Gemini constellation" },
    {
      inlineData: {
        mimeType: "image/png",
        data: base64Image,
      },
    },
  ];
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: prompt,
  });
  
  // Response contains parts with either text or inline_data (image)
  for (const part of response.candidates[0].content.parts) {
    if (part.text) {
      console.log(part.text);
    } else if (part.inlineData) {
      // Save the generated image
      const imageBuffer = Buffer.from(part.inlineData.data, "base64");
      fs.writeFileSync("generated_image.png", imageBuffer);
    }
  }
}
```

## Key Points
1. Pass images as base64 with mimeType
2. Can pass multiple reference images (up to 14 with gemini-3-pro)
3. Response contains parts with either text or inlineData
4. Generated images are returned as base64 in inlineData.data
5. All generated images include SynthID watermark
