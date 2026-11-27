import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export function useKeyboardHeight(active: boolean = true): {
  keyboardHeight: number;
  isKeyboardVisible: boolean;
} {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!active) {
      setKeyboardHeight(0);
      return;
    }

    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      const h = event?.endCoordinates?.height ?? 0;
      setKeyboardHeight(h > 0 ? h : 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [active]);

  return {
    keyboardHeight,
    isKeyboardVisible: keyboardHeight > 0,
  };
}
