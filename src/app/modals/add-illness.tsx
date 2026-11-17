import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { IllnessForm } from '../../components/IllnessForm';
import { useKiddoMed } from '../../context/KiddoMedContext';
import { colors, spacing } from '../../theme/tokens';

export default function AddOrEditIllnessModal() {
  const { memberId, illnessId } = useLocalSearchParams<{
    memberId?: string;
    illnessId?: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { illnesses } = useKiddoMed();

  const existing = illnessId ? illnesses.find((i) => i.id === illnessId) : undefined;
  const isEditing = Boolean(existing);

  useEffect(() => {
    navigation.setOptions({
      title: isEditing ? 'Editar Enfermedad' : 'Registrar Enfermedad',
    });
  }, [isEditing, navigation]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <IllnessForm
        memberId={memberId}
        existing={existing}
        onSaved={({ illnessId: savedId, addTreatmentAfter }) => {
          if (!isEditing && addTreatmentAfter && memberId) {
            router.replace({
              pathname: '/modals/add-treatment',
              params: { memberId, illnessId: savedId },
            });
          } else {
            router.back();
          }
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg + 4, paddingBottom: spacing.xxl },
});
