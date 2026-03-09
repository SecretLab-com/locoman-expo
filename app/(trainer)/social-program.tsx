import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";

export default function TrainerSocialProgramRedirectScreen() {
  const params = useLocalSearchParams<{
    phyllo?: string;
    reason?: string;
    launchConnect?: string;
  }>();

  useEffect(() => {
    router.replace({
      pathname: "/(trainer)/social-progress",
      params,
    } as any);
  }, [params]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
      }}
    >
      <View style={{ alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="small" />
        <Text style={{ marginTop: 12, fontSize: 14, opacity: 0.7 }}>
          Opening social progress...
        </Text>
      </View>
    </View>
  );
}
