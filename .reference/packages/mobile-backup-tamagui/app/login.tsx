import { useState } from 'react';
import { YStack, XStack, Text, Image } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LogIn, Dumbbell, Users, Package, TrendingUp } from '@tamagui/lucide-icons';

import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

// Feature item component
function FeatureItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <XStack gap="$3" alignItems="flex-start">
      <YStack 
        backgroundColor="$primaryLight" 
        padding="$2" 
        borderRadius="$3"
      >
        {icon}
      </YStack>
      <YStack flex={1} gap="$1">
        <Text fontSize="$3" fontWeight="600" color="$color">{title}</Text>
        <Text fontSize="$2" color="$mutedForeground">{description}</Text>
      </YStack>
    </XStack>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading } = useAuth();
  const toast = useToast();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    try {
      setIsLoggingIn(true);
      await login();
    } catch (error) {
      console.error('Login failed:', error);
      toast.error('Login failed', 'Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <YStack 
          flex={1} 
          backgroundColor="$background" 
          padding="$4"
          justifyContent="center"
        >
          <YStack 
            maxWidth={isTablet ? 500 : '100%'} 
            alignSelf="center" 
            width="100%"
            gap="$6"
          >
            {/* Logo and Title */}
            <YStack alignItems="center" gap="$3">
              <YStack 
                backgroundColor="$primary" 
                padding="$4" 
                borderRadius="$5"
              >
                <Dumbbell size={48} color="white" />
              </YStack>
              <YStack alignItems="center" gap="$1">
                <Text fontSize="$8" fontWeight="700" color="$color">
                  LocoMotivate
                </Text>
                <Text fontSize="$4" color="$mutedForeground" textAlign="center">
                  Trainer-powered wellness platform
                </Text>
              </YStack>
            </YStack>

            {/* Login Card */}
            <Card variant="elevated">
              <CardContent gap="$4">
                <YStack gap="$2" alignItems="center">
                  <Text fontSize="$5" fontWeight="600" color="$color">
                    Welcome Back
                  </Text>
                  <Text fontSize="$3" color="$mutedForeground" textAlign="center">
                    Sign in to access your dashboard
                  </Text>
                </YStack>

                <Button 
                  size="lg" 
                  fullWidth
                  onPress={handleLogin}
                  loading={isLoggingIn || isLoading}
                  leftIcon={<LogIn size={20} />}
                >
                  Sign in with Manus
                </Button>

                <Text fontSize="$1" color="$mutedForeground" textAlign="center">
                  By signing in, you agree to our Terms of Service and Privacy Policy
                </Text>
              </CardContent>
            </Card>

            {/* Features */}
            <YStack gap="$4">
              <Text fontSize="$4" fontWeight="600" color="$color" textAlign="center">
                Why LocoMotivate?
              </Text>
              <YStack gap="$3">
                <FeatureItem
                  icon={<Users size={20} color="$primary" />}
                  title="Client Management"
                  description="Easily manage your clients and track their progress"
                />
                <FeatureItem
                  icon={<Package size={20} color="$primary" />}
                  title="Custom Bundles"
                  description="Create personalized product bundles for your clients"
                />
                <FeatureItem
                  icon={<TrendingUp size={20} color="$primary" />}
                  title="Analytics & Insights"
                  description="Track performance and grow your business"
                />
              </YStack>
            </YStack>

            {/* Footer */}
            <YStack alignItems="center" gap="$2">
              <Text fontSize="$2" color="$mutedForeground">
                Don't have an account?
              </Text>
              <Button variant="link" onPress={handleLogin}>
                Sign up as a Trainer
              </Button>
            </YStack>
          </YStack>
        </YStack>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
