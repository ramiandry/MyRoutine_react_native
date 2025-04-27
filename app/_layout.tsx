import { Stack } from "expo-router";

export default function RootLayout() {

  // This layout is used for all routes in the app and without header
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
