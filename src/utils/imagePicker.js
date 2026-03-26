/**
 * Utilitário de seleção de imagem — usa expo-image-picker em todas as plataformas.
 *
 * Android: allowsEditing desabilitado pois o crop nativo do sistema retorna
 * resultado cancelado em muitos OEMs. O picker é lançado após um pequeno delay
 * para garantir que o Alert feche completamente antes de iniciar nova Activity.
 */
import { Alert, Platform, InteractionManager } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { toast } from './toast';

const PERMISSION_DENIED = '__PERMISSION_DENIED__';

// Aguarda o Alert fechar totalmente antes de abrir camera/galeria no Android
function afterAlertClose(fn) {
  if (Platform.OS === 'android') {
    // InteractionManager espera animações/transições terminarem
    InteractionManager.runAfterInteractions(() => {
      setTimeout(fn, 100);
    });
  } else {
    fn();
  }
}

async function pickFromGallery() {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted' && status !== 'limited') {
    return PERMISSION_DENIED;
  }
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // Crop desabilitado no Android — o editor nativo do sistema
      // retorna resultado cancelado em muitos OEMs
      allowsEditing: Platform.OS !== 'android',
      aspect: [1, 1],
      quality: 0.7,
    });
    return (!result.canceled && result.assets?.[0]?.uri) ? result.assets[0].uri : null;
  } catch {
    return null;
  }
}

async function pickFromCamera() {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    return PERMISSION_DENIED;
  }
  try {
    // allowsEditing desabilitado no Android — crop de sistema causa crash em OEMs
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: Platform.OS !== 'android',
      aspect: [1, 1],
      quality: 0.7,
    });
    return (!result.canceled && result.assets?.[0]?.uri) ? result.assets[0].uri : null;
  } catch {
    return null;
  }
}

/**
 * Exibe o Alert de seleção (Câmera / Galeria) e chama `onUri(uri)` com o resultado.
 * Use no lugar das funções inline de pickFromGallery/pickFromCamera nos screens.
 */
export function showImagePickerAlert(onUri) {
  Alert.alert('Foto de perfil', 'Escolha uma opção', [
    {
      text: 'Câmera',
      onPress: () => {
        afterAlertClose(async () => {
          const uri = await pickFromCamera();
          if (uri === PERMISSION_DENIED) {
            toast.error('Permita o acesso à câmera nas configurações do celular.');
          } else if (uri) {
            onUri(uri);
          }
        });
      },
    },
    {
      text: 'Galeria',
      onPress: () => {
        afterAlertClose(async () => {
          const uri = await pickFromGallery();
          if (uri === PERMISSION_DENIED) {
            toast.error('Permita o acesso à galeria nas configurações do celular.');
          } else if (uri) {
            onUri(uri);
          }
        });
      },
    },
    { text: 'Cancelar', style: 'cancel' },
  ]);
}
