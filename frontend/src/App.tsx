import { useState } from 'react';
import { Alert, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OnboardingScreen } from './screens/OnboardingScreen';

function App() {
  const [isCompleting, setIsCompleting] = useState(false);

  const handleComplete = async () => {
    setIsCompleting(true);

    try {
      await new Promise<void>(resolve => {
        setTimeout(() => resolve(), 450);
      });
      Alert.alert(
        'Onboarding complete',
        'Next, we can wire this to the auth flow.',
      );
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#F6F7F2" />
      <OnboardingScreen
        isCompleting={isCompleting}
        onComplete={handleComplete}
      />
    </SafeAreaProvider>
  );
}

export default App;
