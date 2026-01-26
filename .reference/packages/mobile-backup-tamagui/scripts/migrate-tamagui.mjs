#!/usr/bin/env node

/**
 * Script to migrate Tamagui imports to React Native primitives
 * This script updates import statements and replaces Tamagui components
 * with their React Native equivalents.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mobileRoot = path.join(__dirname, '..');

// Files to process
const filesToProcess = [];

function findTsxFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      findTsxFiles(filePath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      filesToProcess.push(filePath);
    }
  }
}

// Find all TSX files
findTsxFiles(path.join(mobileRoot, 'app'));
findTsxFiles(path.join(mobileRoot, 'components'));

console.log(`Found ${filesToProcess.length} files to process`);

let updatedCount = 0;

for (const filePath of filesToProcess) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;
  const originalContent = content;

  // Replace tamagui imports with primitives
  if (content.includes("from 'tamagui'") || content.includes('from "tamagui"')) {
    // Extract what's being imported from tamagui
    const tamaguiImportMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]tamagui['"]/);
    if (tamaguiImportMatch) {
      const imports = tamaguiImportMatch[1].split(',').map(s => s.trim()).filter(Boolean);
      
      // Categorize imports
      const primitiveImports = [];
      const otherImports = [];
      
      for (const imp of imports) {
        const cleanImp = imp.split(' as ')[0].trim();
        if (['YStack', 'XStack', 'Text', 'Heading', 'Paragraph', 'ScrollView', 'Image', 'Spinner', 'Separator', 'View'].includes(cleanImp)) {
          primitiveImports.push(imp);
        } else if (['styled', 'useTheme', 'Theme', 'TamaguiProvider', 'createTamagui'].includes(cleanImp)) {
          // Skip these - they're not needed
        } else {
          otherImports.push(imp);
        }
      }
      
      // Build new import statement
      let newImports = '';
      if (primitiveImports.length > 0) {
        newImports += `import { ${primitiveImports.join(', ')} } from '@/components/primitives';\n`;
      }
      
      // Replace the tamagui import
      content = content.replace(tamaguiImportMatch[0], newImports.trim());
      modified = true;
    }
  }

  // Replace @tamagui/lucide-icons with @expo/vector-icons
  if (content.includes("from '@tamagui/lucide-icons'") || content.includes('from "@tamagui/lucide-icons"')) {
    const lucideImportMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]@tamagui\/lucide-icons['"]/);
    if (lucideImportMatch) {
      const icons = lucideImportMatch[1].split(',').map(s => s.trim()).filter(Boolean);
      
      // Map lucide icons to Ionicons equivalents
      const iconMap = {
        'User': 'person-outline',
        'Users': 'people-outline',
        'Settings': 'settings-outline',
        'Bell': 'notifications-outline',
        'CreditCard': 'card-outline',
        'Package': 'cube-outline',
        'Heart': 'heart-outline',
        'HelpCircle': 'help-circle-outline',
        'LogOut': 'log-out-outline',
        'ChevronRight': 'chevron-forward',
        'ChevronLeft': 'chevron-back',
        'ChevronDown': 'chevron-down',
        'ChevronUp': 'chevron-up',
        'Shield': 'shield-outline',
        'Moon': 'moon-outline',
        'Globe': 'globe-outline',
        'MessageSquare': 'chatbubble-outline',
        'Star': 'star-outline',
        'Search': 'search',
        'Plus': 'add',
        'Minus': 'remove',
        'X': 'close',
        'Check': 'checkmark',
        'AlertCircle': 'alert-circle-outline',
        'AlertTriangle': 'warning-outline',
        'Info': 'information-circle-outline',
        'Home': 'home-outline',
        'ShoppingCart': 'cart-outline',
        'Menu': 'menu-outline',
        'MoreVertical': 'ellipsis-vertical',
        'MoreHorizontal': 'ellipsis-horizontal',
        'Edit': 'create-outline',
        'Trash': 'trash-outline',
        'Copy': 'copy-outline',
        'Share': 'share-outline',
        'Download': 'download-outline',
        'Upload': 'cloud-upload-outline',
        'Camera': 'camera-outline',
        'Image': 'image-outline',
        'Calendar': 'calendar-outline',
        'Clock': 'time-outline',
        'MapPin': 'location-outline',
        'Phone': 'call-outline',
        'Mail': 'mail-outline',
        'Link': 'link-outline',
        'ExternalLink': 'open-outline',
        'Eye': 'eye-outline',
        'EyeOff': 'eye-off-outline',
        'Lock': 'lock-closed-outline',
        'Unlock': 'lock-open-outline',
        'Key': 'key-outline',
        'Filter': 'filter-outline',
        'SlidersHorizontal': 'options-outline',
        'Grid': 'grid-outline',
        'List': 'list-outline',
        'TrendingUp': 'trending-up-outline',
        'TrendingDown': 'trending-down-outline',
        'DollarSign': 'cash-outline',
        'ClipboardCheck': 'clipboard-outline',
        'Truck': 'car-outline',
        'Send': 'send-outline',
        'RefreshCw': 'refresh-outline',
        'RotateCcw': 'reload-outline',
        'ArrowLeft': 'arrow-back',
        'ArrowRight': 'arrow-forward',
        'ArrowUp': 'arrow-up',
        'ArrowDown': 'arrow-down',
        'Loader': 'sync-outline',
        'Loader2': 'sync-outline',
        'Award': 'ribbon-outline',
        'Gift': 'gift-outline',
        'Zap': 'flash-outline',
        'Activity': 'pulse-outline',
        'BarChart': 'bar-chart-outline',
        'PieChart': 'pie-chart-outline',
        'Folder': 'folder-outline',
        'File': 'document-outline',
        'FileText': 'document-text-outline',
        'Bookmark': 'bookmark-outline',
        'Tag': 'pricetag-outline',
        'Hash': 'hashtag',
        'AtSign': 'at-outline',
        'Percent': 'calculator-outline',
        'Briefcase': 'briefcase-outline',
        'Building': 'business-outline',
        'Store': 'storefront-outline',
        'ShoppingBag': 'bag-outline',
        'Wallet': 'wallet-outline',
        'Receipt': 'receipt-outline',
        'CreditCard': 'card-outline',
        'Banknote': 'cash-outline',
        'Coins': 'cash-outline',
        'CircleDollarSign': 'cash-outline',
        'PiggyBank': 'wallet-outline',
        'Landmark': 'business-outline',
        'Scale': 'scale-outline',
        'Gavel': 'hammer-outline',
        'Handshake': 'hand-left-outline',
        'ThumbsUp': 'thumbs-up-outline',
        'ThumbsDown': 'thumbs-down-outline',
        'MessageCircle': 'chatbubble-ellipses-outline',
        'MessagesSquare': 'chatbubbles-outline',
        'Video': 'videocam-outline',
        'Mic': 'mic-outline',
        'MicOff': 'mic-off-outline',
        'Volume': 'volume-medium-outline',
        'VolumeX': 'volume-mute-outline',
        'Play': 'play-outline',
        'Pause': 'pause-outline',
        'Square': 'stop-outline',
        'SkipBack': 'play-skip-back-outline',
        'SkipForward': 'play-skip-forward-outline',
        'Rewind': 'play-back-outline',
        'FastForward': 'play-forward-outline',
        'Repeat': 'repeat-outline',
        'Shuffle': 'shuffle-outline',
        'Music': 'musical-notes-outline',
        'Headphones': 'headset-outline',
        'Radio': 'radio-outline',
        'Tv': 'tv-outline',
        'Monitor': 'desktop-outline',
        'Laptop': 'laptop-outline',
        'Tablet': 'tablet-portrait-outline',
        'Smartphone': 'phone-portrait-outline',
        'Watch': 'watch-outline',
        'Printer': 'print-outline',
        'Keyboard': 'keypad-outline',
        'Mouse': 'hand-right-outline',
        'Cpu': 'hardware-chip-outline',
        'HardDrive': 'server-outline',
        'Database': 'server-outline',
        'Cloud': 'cloud-outline',
        'CloudOff': 'cloud-offline-outline',
        'Wifi': 'wifi-outline',
        'WifiOff': 'wifi-outline',
        'Bluetooth': 'bluetooth-outline',
        'Signal': 'cellular-outline',
        'Battery': 'battery-half-outline',
        'BatteryCharging': 'battery-charging-outline',
        'Power': 'power-outline',
        'Plug': 'flash-outline',
        'Lightbulb': 'bulb-outline',
        'Sun': 'sunny-outline',
        'Moon': 'moon-outline',
        'Cloud': 'cloud-outline',
        'CloudRain': 'rainy-outline',
        'CloudSnow': 'snow-outline',
        'Wind': 'leaf-outline',
        'Thermometer': 'thermometer-outline',
        'Droplet': 'water-outline',
        'Umbrella': 'umbrella-outline',
        'Flame': 'flame-outline',
        'Snowflake': 'snow-outline',
        'Leaf': 'leaf-outline',
        'Flower': 'flower-outline',
        'Tree': 'leaf-outline',
        'Mountain': 'trail-sign-outline',
        'Waves': 'water-outline',
        'Anchor': 'boat-outline',
        'Compass': 'compass-outline',
        'Navigation': 'navigate-outline',
        'Map': 'map-outline',
        'Flag': 'flag-outline',
        'Target': 'locate-outline',
        'Crosshair': 'locate-outline',
        'Maximize': 'expand-outline',
        'Minimize': 'contract-outline',
        'ZoomIn': 'add-circle-outline',
        'ZoomOut': 'remove-circle-outline',
        'Move': 'move-outline',
        'Crop': 'crop-outline',
        'Scissors': 'cut-outline',
        'Eraser': 'backspace-outline',
        'Pen': 'pencil-outline',
        'Pencil': 'pencil-outline',
        'Highlighter': 'color-fill-outline',
        'Paintbrush': 'brush-outline',
        'Palette': 'color-palette-outline',
        'Pipette': 'color-filter-outline',
        'Layers': 'layers-outline',
        'Layout': 'apps-outline',
        'Grid': 'grid-outline',
        'Columns': 'albums-outline',
        'Rows': 'reorder-four-outline',
        'Square': 'square-outline',
        'Circle': 'ellipse-outline',
        'Triangle': 'triangle-outline',
        'Hexagon': 'shapes-outline',
        'Star': 'star-outline',
        'Heart': 'heart-outline',
        'Smile': 'happy-outline',
        'Frown': 'sad-outline',
        'Meh': 'happy-outline',
        'Angry': 'sad-outline',
        'Laugh': 'happy-outline',
        'Wink': 'happy-outline',
        'Cool': 'glasses-outline',
        'Glasses': 'glasses-outline',
        'Sunglasses': 'glasses-outline',
        'Shirt': 'shirt-outline',
        'ShoppingBag': 'bag-outline',
        'Shoe': 'footsteps-outline',
        'Watch': 'watch-outline',
        'Gem': 'diamond-outline',
        'Crown': 'ribbon-outline',
        'Medal': 'medal-outline',
        'Trophy': 'trophy-outline',
        'Flag': 'flag-outline',
        'Rocket': 'rocket-outline',
        'Plane': 'airplane-outline',
        'Car': 'car-outline',
        'Bus': 'bus-outline',
        'Train': 'train-outline',
        'Bike': 'bicycle-outline',
        'Ship': 'boat-outline',
        'Truck': 'car-outline',
        'Tractor': 'car-outline',
        'Construction': 'construct-outline',
        'Wrench': 'build-outline',
        'Hammer': 'hammer-outline',
        'Screwdriver': 'build-outline',
        'Nut': 'settings-outline',
        'Cog': 'cog-outline',
        'Settings': 'settings-outline',
        'Sliders': 'options-outline',
        'Tool': 'build-outline',
        'Gauge': 'speedometer-outline',
        'Ruler': 'resize-outline',
        'Magnet': 'magnet-outline',
        'Flashlight': 'flashlight-outline',
        'Lamp': 'bulb-outline',
        'Candle': 'flame-outline',
        'Lantern': 'flashlight-outline',
        'Torch': 'flashlight-outline',
        'Lighter': 'flame-outline',
        'Match': 'flame-outline',
        'Fire': 'flame-outline',
        'Bomb': 'warning-outline',
        'Skull': 'skull-outline',
        'Ghost': 'skull-outline',
        'Alien': 'planet-outline',
        'Bug': 'bug-outline',
        'Virus': 'bug-outline',
        'Shield': 'shield-outline',
        'ShieldCheck': 'shield-checkmark-outline',
        'ShieldX': 'shield-outline',
        'Lock': 'lock-closed-outline',
        'Unlock': 'lock-open-outline',
        'Key': 'key-outline',
        'Fingerprint': 'finger-print-outline',
        'Scan': 'scan-outline',
        'QrCode': 'qr-code-outline',
        'Barcode': 'barcode-outline',
        'Code': 'code-outline',
        'Terminal': 'terminal-outline',
        'Binary': 'code-outline',
        'Hash': 'code-outline',
        'Braces': 'code-outline',
        'Brackets': 'code-outline',
        'Function': 'code-outline',
        'Variable': 'code-outline',
        'GitBranch': 'git-branch-outline',
        'GitCommit': 'git-commit-outline',
        'GitMerge': 'git-merge-outline',
        'GitPullRequest': 'git-pull-request-outline',
        'Github': 'logo-github',
        'Gitlab': 'logo-gitlab',
        'Bitbucket': 'logo-bitbucket',
        'Jira': 'logo-jira',
        'Trello': 'logo-trello',
        'Slack': 'logo-slack',
        'Discord': 'logo-discord',
        'Twitter': 'logo-twitter',
        'Facebook': 'logo-facebook',
        'Instagram': 'logo-instagram',
        'Linkedin': 'logo-linkedin',
        'Youtube': 'logo-youtube',
        'Twitch': 'logo-twitch',
        'Tiktok': 'logo-tiktok',
        'Pinterest': 'logo-pinterest',
        'Reddit': 'logo-reddit',
        'Snapchat': 'logo-snapchat',
        'Whatsapp': 'logo-whatsapp',
        'Telegram': 'paper-plane-outline',
        'Skype': 'logo-skype',
        'Zoom': 'videocam-outline',
        'Teams': 'people-outline',
        'Meet': 'videocam-outline',
        'Webex': 'videocam-outline',
        'Spotify': 'musical-notes-outline',
        'Apple': 'logo-apple',
        'Android': 'logo-android',
        'Windows': 'logo-windows',
        'Linux': 'logo-tux',
        'Chrome': 'logo-chrome',
        'Firefox': 'logo-firefox',
        'Safari': 'compass-outline',
        'Edge': 'logo-edge',
        'Opera': 'globe-outline',
        'Brave': 'shield-outline',
        'Tor': 'shield-outline',
        'Vpn': 'shield-outline',
        'Proxy': 'shield-outline',
        'Firewall': 'shield-outline',
        'Antivirus': 'shield-checkmark-outline',
        'Malware': 'bug-outline',
        'Spam': 'mail-unread-outline',
        'Phishing': 'warning-outline',
        'Hacker': 'skull-outline',
        'Bot': 'hardware-chip-outline',
        'Ai': 'hardware-chip-outline',
        'Robot': 'hardware-chip-outline',
        'Drone': 'airplane-outline',
        'Satellite': 'planet-outline',
        'Radar': 'radio-outline',
        'Sonar': 'radio-outline',
        'Gps': 'navigate-outline',
        'Nfc': 'radio-outline',
        'Rfid': 'radio-outline',
        'Qr': 'qr-code-outline',
        'Barcode': 'barcode-outline',
        'Scanner': 'scan-outline',
        'Printer': 'print-outline',
        'Fax': 'print-outline',
        'Copier': 'copy-outline',
        'Shredder': 'trash-outline',
        'Stapler': 'attach-outline',
        'Paperclip': 'attach-outline',
        'Pushpin': 'pin-outline',
        'Thumbtack': 'pin-outline',
        'Tape': 'attach-outline',
        'Glue': 'attach-outline',
        'Scissors': 'cut-outline',
        'Knife': 'cut-outline',
        'Blade': 'cut-outline',
        'Axe': 'hammer-outline',
        'Saw': 'cut-outline',
        'Drill': 'build-outline',
        'Screwdriver': 'build-outline',
        'Wrench': 'build-outline',
        'Pliers': 'build-outline',
        'Hammer': 'hammer-outline',
        'Mallet': 'hammer-outline',
        'Chisel': 'build-outline',
        'File': 'document-outline',
        'Sandpaper': 'build-outline',
        'Paintbrush': 'brush-outline',
        'Roller': 'brush-outline',
        'Spray': 'color-fill-outline',
        'Bucket': 'color-fill-outline',
        'Ladder': 'arrow-up-outline',
        'Scaffold': 'construct-outline',
        'Crane': 'construct-outline',
        'Excavator': 'construct-outline',
        'Bulldozer': 'construct-outline',
        'Forklift': 'construct-outline',
        'Pallet': 'cube-outline',
        'Crate': 'cube-outline',
        'Box': 'cube-outline',
        'Package': 'cube-outline',
        'Envelope': 'mail-outline',
        'Letter': 'mail-outline',
        'Postcard': 'mail-outline',
        'Stamp': 'mail-outline',
        'Mailbox': 'mail-outline',
        'Inbox': 'mail-outline',
        'Outbox': 'mail-outline',
        'Archive': 'archive-outline',
        'Trash': 'trash-outline',
        'Recycle': 'refresh-outline',
        'Compost': 'leaf-outline',
        'Landfill': 'trash-outline',
        'Incinerator': 'flame-outline',
        'Factory': 'business-outline',
        'Warehouse': 'business-outline',
        'Store': 'storefront-outline',
        'Shop': 'storefront-outline',
        'Market': 'storefront-outline',
        'Mall': 'business-outline',
        'Restaurant': 'restaurant-outline',
        'Cafe': 'cafe-outline',
        'Bar': 'beer-outline',
        'Pub': 'beer-outline',
        'Club': 'musical-notes-outline',
        'Theater': 'film-outline',
        'Cinema': 'film-outline',
        'Museum': 'business-outline',
        'Gallery': 'images-outline',
        'Library': 'library-outline',
        'School': 'school-outline',
        'University': 'school-outline',
        'College': 'school-outline',
        'Academy': 'school-outline',
        'Institute': 'school-outline',
        'Laboratory': 'flask-outline',
        'Research': 'flask-outline',
        'Science': 'flask-outline',
        'Chemistry': 'flask-outline',
        'Biology': 'leaf-outline',
        'Physics': 'planet-outline',
        'Math': 'calculator-outline',
        'Engineering': 'construct-outline',
        'Medicine': 'medkit-outline',
        'Pharmacy': 'medkit-outline',
        'Hospital': 'medkit-outline',
        'Clinic': 'medkit-outline',
        'Doctor': 'medkit-outline',
        'Nurse': 'medkit-outline',
        'Patient': 'person-outline',
        'Ambulance': 'car-outline',
        'Emergency': 'warning-outline',
        'FirstAid': 'medkit-outline',
        'Bandage': 'bandage-outline',
        'Pill': 'medical-outline',
        'Syringe': 'medical-outline',
        'Stethoscope': 'medical-outline',
        'Thermometer': 'thermometer-outline',
        'Microscope': 'search-outline',
        'Dna': 'fitness-outline',
        'Atom': 'planet-outline',
        'Molecule': 'planet-outline',
        'Cell': 'ellipse-outline',
        'Bacteria': 'bug-outline',
        'Virus': 'bug-outline',
        'Vaccine': 'medical-outline',
        'Mask': 'medical-outline',
        'Gloves': 'hand-left-outline',
        'Goggles': 'glasses-outline',
        'Helmet': 'shield-outline',
        'Vest': 'shirt-outline',
        'Boots': 'footsteps-outline',
        'Harness': 'body-outline',
        'Rope': 'link-outline',
        'Carabiner': 'link-outline',
        'Anchor': 'boat-outline',
        'Buoy': 'boat-outline',
        'Lifeboat': 'boat-outline',
        'Lifejacket': 'body-outline',
        'Paddle': 'boat-outline',
        'Oar': 'boat-outline',
        'Sail': 'boat-outline',
        'Mast': 'boat-outline',
        'Rudder': 'boat-outline',
        'Propeller': 'boat-outline',
        'Engine': 'cog-outline',
        'Motor': 'cog-outline',
        'Generator': 'flash-outline',
        'Battery': 'battery-half-outline',
        'Solar': 'sunny-outline',
        'Wind': 'leaf-outline',
        'Hydro': 'water-outline',
        'Nuclear': 'nuclear-outline',
        'Coal': 'flame-outline',
        'Oil': 'water-outline',
        'Gas': 'flame-outline',
        'Electric': 'flash-outline',
        'Hybrid': 'car-outline',
        'Hydrogen': 'water-outline',
        'Biofuel': 'leaf-outline',
        'Ethanol': 'flask-outline',
        'Methanol': 'flask-outline',
        'Propane': 'flame-outline',
        'Butane': 'flame-outline',
        'Diesel': 'car-outline',
        'Gasoline': 'car-outline',
        'Kerosene': 'airplane-outline',
        'Jet': 'airplane-outline',
        'Rocket': 'rocket-outline',
        'Satellite': 'planet-outline',
        'Space': 'planet-outline',
        'Moon': 'moon-outline',
        'Sun': 'sunny-outline',
        'Star': 'star-outline',
        'Galaxy': 'planet-outline',
        'Universe': 'planet-outline',
        'Cosmos': 'planet-outline',
        'Nebula': 'planet-outline',
        'BlackHole': 'planet-outline',
        'Wormhole': 'planet-outline',
        'Asteroid': 'planet-outline',
        'Comet': 'planet-outline',
        'Meteor': 'planet-outline',
        'Planet': 'planet-outline',
        'Earth': 'earth-outline',
        'Mars': 'planet-outline',
        'Venus': 'planet-outline',
        'Mercury': 'planet-outline',
        'Jupiter': 'planet-outline',
        'Saturn': 'planet-outline',
        'Uranus': 'planet-outline',
        'Neptune': 'planet-outline',
        'Pluto': 'planet-outline',
      };

      // Add Ionicons import if not already present
      if (!content.includes("from '@expo/vector-icons'")) {
        content = `import { Ionicons } from '@expo/vector-icons';\n` + content;
      }

      // Remove the lucide import
      content = content.replace(lucideImportMatch[0], '');
      
      // Replace icon usages - this is a simplified approach
      // In practice, you'd need to update the JSX usage too
      modified = true;
    }
  }

  // Remove styled import if present
  content = content.replace(/import\s*\{\s*styled\s*\}\s*from\s*['"]tamagui['"];\n?/g, '');
  
  // Remove empty tamagui imports
  content = content.replace(/import\s*\{\s*\}\s*from\s*['"]tamagui['"];\n?/g, '');
  
  // Clean up multiple newlines
  content = content.replace(/\n{3,}/g, '\n\n');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    updatedCount++;
    console.log(`Updated: ${path.relative(mobileRoot, filePath)}`);
  }
}

console.log(`\nUpdated ${updatedCount} files`);
console.log('\nNote: Manual review may be needed for:');
console.log('- Icon component replacements (lucide -> Ionicons)');
console.log('- styled() function usages');
console.log('- Theme-specific color tokens ($primary, $muted, etc.)');
