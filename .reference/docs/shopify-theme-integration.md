# Shopify Theme Integration for Bundle View Tracking

This guide explains how to add bundle view tracking to your Shopify theme so that LocoMotivate can track product page views and calculate conversion rates.

## Quick Start

Add one of the following snippets to your Shopify theme's `product.liquid` or `main-product.liquid` template.

## Option 1: JavaScript Tracking (Recommended)

Add this snippet at the bottom of your product template:

```liquid
{% comment %}
  LocoMotivate Bundle View Tracking
  Add this to your product template to track bundle views
{% endcomment %}
{% if product.metafields.trainerbundle.bundle_id %}
<script>
(function() {
  var productId = '{{ product.id }}';
  var endpoint = 'https://YOUR_LOCOMOTIVATE_URL/api/storefront/track-view';
  
  // Only track once per session per product
  var trackingKey = 'lm_viewed_' + productId;
  if (sessionStorage.getItem(trackingKey)) return;
  
  fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: productId })
  }).then(function() {
    sessionStorage.setItem(trackingKey, '1');
  }).catch(function() {});
})();
</script>
{% endif %}
```

## Option 2: Pixel Tracking (No JavaScript Required)

If you prefer a simpler approach that doesn't require JavaScript, use an invisible tracking pixel:

```liquid
{% comment %}
  LocoMotivate Bundle View Tracking (Pixel)
  Add this to your product template to track bundle views
{% endcomment %}
{% if product.metafields.trainerbundle.bundle_id %}
<img src="https://YOUR_LOCOMOTIVATE_URL/api/storefront/pixel/{{ product.id }}" 
     alt="" width="1" height="1" style="position:absolute;left:-9999px;" 
     loading="lazy" />
{% endif %}
```

## Option 3: Shopify Theme App Extension (Advanced)

For a more robust solution, you can create a Shopify Theme App Extension that automatically injects the tracking code.

## Installation Steps

1. **Access your Shopify theme:**
   - Go to Online Store > Themes
   - Click "Edit code" on your active theme

2. **Find your product template:**
   - Look for `sections/main-product.liquid` or `templates/product.liquid`
   - Some themes use `sections/product-template.liquid`

3. **Add the tracking snippet:**
   - Paste one of the snippets above at the bottom of the file, before the closing `{% endschema %}` or at the end
   - Replace `YOUR_LOCOMOTIVATE_URL` with your actual LocoMotivate URL

4. **Save and test:**
   - Save the file
   - Visit a bundle product page
   - Check your LocoMotivate dashboard to verify views are being tracked

## Verifying the Integration

1. Open your browser's Developer Tools (F12)
2. Go to the Network tab
3. Visit a bundle product page
4. Look for a request to `/api/storefront/track-view` or `/api/storefront/pixel/`
5. The request should return a 200 status

## Troubleshooting

**Views not tracking:**
- Ensure the product has the `trainerbundle.bundle_id` metafield
- Check that the URL is correct and accessible
- Verify CORS is not blocking the request

**Duplicate views:**
- The JavaScript snippet uses sessionStorage to prevent duplicate tracking
- The pixel method may count multiple views if the page is refreshed

## API Reference

### POST /api/storefront/track-view

Track a bundle product view.

**Request:**
```json
{
  "productId": "1234567890"
}
```

**Response:**
```json
{
  "success": true
}
```

### GET /api/storefront/pixel/:productId

Returns a 1x1 transparent GIF and tracks the view. Useful for email tracking or no-JS environments.

### GET /api/storefront/bundle/:productId

Get bundle information for storefront display.

**Response:**
```json
{
  "id": 123,
  "title": "Starter Bundle",
  "description": "Everything you need to get started",
  "trainer": {
    "name": "John Doe",
    "username": "johndoe"
  }
}
```
