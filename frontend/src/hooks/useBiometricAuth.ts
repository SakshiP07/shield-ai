import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import {
  BiometricAuthError,
  createBiometricCredential,
  detectBiometricSupport,
  getBiometricButtonLabel,
  getBiometricUnavailableMessage,
  getBiometricAssertion,
  getLocalPasskeyIds,
  hasLocalBiometricRegistrationHint,
  hasLocalPasskeyForSite,
  markBiometricRegisteredLocally,
  type BiometricSupport,
} from '../lib/biometric';

export function useBiometricAuth(serverEnabled: boolean) {
  const [support, setSupport] = useState<BiometricSupport | null>(null);
  const [probing, setProbing] = useState(true);

  useEffect(() => {
    let active = true;
    detectBiometricSupport()
      .then((result) => {
        if (active) setSupport(result);
      })
      .finally(() => {
        if (active) setProbing(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const canUseBiometrics = Boolean(serverEnabled && support?.available && support.platformAuthenticator);
  const hasLocalPasskey = hasLocalPasskeyForSite();
  const canLoginWithBiometric = canUseBiometrics;
  const buttonLabel = support ? getBiometricButtonLabel(support.detectedMethods) : 'Sign in with a passkey';
  const unavailableMessage = !serverEnabled
    ? 'Biometric sign-in is disabled on the server.'
    : getBiometricUnavailableMessage(support?.reason);

  const loginWithBiometric = useCallback(async () => {
    if (!canUseBiometrics) {
      throw new BiometricAuthError(unavailableMessage, 'unavailable');
    }
    const credentialIds = getLocalPasskeyIds();
    const options = await api.biometricLoginOptions(credentialIds);
    const sessionId = options.session_id as string;
    const { session_id: _ignored, ...requestOptions } = options;
    const credential = await getBiometricAssertion(requestOptions);
    return api.biometricLoginVerify(sessionId, credential);
  }, [canUseBiometrics, unavailableMessage]);

  const registerBiometric = useCallback(async (deviceLabel?: string) => {
    if (!canUseBiometrics) {
      throw new BiometricAuthError(unavailableMessage, 'unavailable');
    }
    const options = await api.biometricRegisterOptions();
    const credential = await createBiometricCredential(options);
    const result = await api.biometricRegisterVerify(credential, deviceLabel);
    markBiometricRegisteredLocally(true, result.credential_id);
    return result;
  }, [canUseBiometrics, unavailableMessage]);

  return {
    support,
    probing,
    canUseBiometrics,
    canLoginWithBiometric,
    hasLocalPasskey,
    hasLocalRegistrationHint: hasLocalBiometricRegistrationHint(),
    buttonLabel,
    unavailableMessage,
    loginWithBiometric,
    registerBiometric,
  };
}
