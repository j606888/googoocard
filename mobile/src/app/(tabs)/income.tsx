import { SafeAreaView } from 'react-native-safe-area-context';

import { WebScreen } from '../../components/WebScreen';

export default function Tab() {
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1 }}>
      <WebScreen path="/income" />
    </SafeAreaView>
  );
}
