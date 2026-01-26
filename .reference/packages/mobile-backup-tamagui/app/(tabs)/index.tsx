import { YStack, Text, H1, Paragraph, Button, XStack } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <YStack flex={1} padding="$4" gap="$4">
        <H1 color="$color">Welcome to LocoMotivate</H1>
        <Paragraph color="$colorSubtle">
          Your fitness training marketplace
        </Paragraph>
        
        <YStack gap="$3" marginTop="$4">
          <Button
            size="$4"
            theme="purple"
            onPress={() => router.push('/shop')}
          >
            Browse Training Bundles
          </Button>
          
          <Button
            size="$4"
            variant="outlined"
            onPress={() => router.push('/login')}
          >
            Sign In
          </Button>
        </YStack>

        <YStack marginTop="$6" gap="$2">
          <Text fontSize="$3" color="$colorSubtle">Quick Links:</Text>
          <XStack gap="$2" flexWrap="wrap">
            <Button size="$3" chromeless onPress={() => router.push('/manager')}>
              Manager Dashboard
            </Button>
            <Button size="$3" chromeless onPress={() => router.push('/trainer')}>
              Trainer Portal
            </Button>
            <Button size="$3" chromeless onPress={() => router.push('/client')}>
              Client Area
            </Button>
          </XStack>
        </YStack>
      </YStack>
    </SafeAreaView>
  );
}
