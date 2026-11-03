import { DetectLabelsCommand } from '@aws-sdk/client-rekognition';
import { DetectDocumentTextCommand } from '@aws-sdk/client-textract';
import { rekognition, textract, isAwsConfigured } from '../config/aws.js';

/**
 * Category keywords mapping to map Rekognition labels to CampusFind category IDs or names
 */
const CATEGORY_KEYWORDS = {
  1: ['phone', 'mobile', 'laptop', 'charger', 'electronics', 'computer', 'earphones', 'headphones', 'calculator', 'gadget'], // Electronics
  2: ['bottle', 'flask', 'thermos', 'mug', 'cup', 'sipper'], // Bottles & Drinkware
  3: ['card', 'id card', 'wallet', 'purse', 'passport', 'license', 'money'], // Cards & Wallets
  4: ['bag', 'backpack', 'handbag', 'tote', 'luggage', 'briefcase'], // Bags & Backpacks
  5: ['key', 'keychain'], // Keys
  6: ['watch', 'wristwatch', 'smartwatch', 'jewellery', 'ring', 'glasses', 'sunglasses'], // Accessories
  7: ['book', 'notebook', 'folder', 'pen', 'stationery', 'pencil'] // Books & Stationery
};

/**
 * Analyze an uploaded item image using AWS Rekognition and AWS Textract
 * @param {Buffer} imageBuffer - Raw image buffer from multer
 * @returns {Promise<{labels: string[], extractedText: string, suggestedCategory: string|null, colors: string[]}>}
 */
export async function analyzeItemImage(imageBuffer) {
  const result = {
    labels: [],
    extractedText: '',
    suggestedCategory: null,
    suggestedCategoryId: null,
    colors: [],
    isAwsAnalyzed: false
  };

  if (!imageBuffer) return result;

  // 1. Rekognition: Label and Object Detection
  if (isAwsConfigured.rekognition) {
    try {
      const labelCommand = new DetectLabelsCommand({
        Image: { Bytes: imageBuffer },
        MaxLabels: 15,
        MinConfidence: 65,
        Features: ['GENERAL_LABELS', 'IMAGE_PROPERTIES']
      });

      const labelData = await rekognition.send(labelCommand);
      result.isAwsAnalyzed = true;

      // Extract detected labels
      result.labels = (labelData.Labels || [])
        .map(l => l.Name)
        .filter(Boolean);

      // Extract dominant colors if present in image properties
      const dominantColors = labelData.ImageProperties?.DominantColors || [];
      result.colors = dominantColors
        .slice(0, 3)
        .map(c => c.CSSColor || c.HexCode)
        .filter(Boolean);

      // Map labels to suggested category
      const lowerLabels = result.labels.map(l => l.toLowerCase());
      for (const [catId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some(kw => lowerLabels.some(lbl => lbl.includes(kw)))) {
          result.suggestedCategoryId = parseInt(catId, 10);
          break;
        }
      }
    } catch (err) {
      console.warn('[AWS Rekognition] Image analysis warning:', err.message);
    }
  }

  // 2. Textract: Extract Text / Identifiers from Image
  if (isAwsConfigured.textract) {
    try {
      const textCommand = new DetectDocumentTextCommand({
        Document: { Bytes: imageBuffer }
      });

      const textData = await textract.send(textCommand);
      const lines = (textData.Blocks || [])
        .filter(b => b.BlockType === 'LINE' && b.Text)
        .map(b => b.Text.trim());

      result.extractedText = lines.join('; ');
      result.isAwsAnalyzed = true;
    } catch (err) {
      console.warn('[AWS Textract] Text extraction warning:', err.message);
    }
  }

  return result;
}

