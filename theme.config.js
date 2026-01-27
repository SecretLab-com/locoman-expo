/** @type {const} */
const themeColors = {
  // Bright Express inspired dark theme
  // Primary: Bright blue accent (from search bar icon and UI accents)
  primary: { light: '#3B82F6', dark: '#60A5FA' },
  // Background: Very dark navy/black
  background: { light: '#F8FAFC', dark: '#0A0A14' },
  // Surface: Dark navy for cards and elevated elements
  surface: { light: '#F1F5F9', dark: '#151520' },
  // Foreground: White text on dark
  foreground: { light: '#0F172A', dark: '#FFFFFF' },
  // Muted: Gray for secondary text
  muted: { light: '#64748B', dark: '#9CA3AF' },
  // Border: Dark blue-gray
  border: { light: '#E2E8F0', dark: '#1E293B' },
  // Success: Green
  success: { light: '#22C55E', dark: '#4ADE80' },
  // Warning: Amber/yellow (for buttons like "Add to Basket")
  warning: { light: '#F59E0B', dark: '#FBBF24' },
  // Error: Red (for "Sold out" badges)
  error: { light: '#EF4444', dark: '#F87171' },
};

module.exports = { themeColors };
