import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { color, layout, space, type } from '../theme/tokens';
import { useSession } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { createPost, type NewPostVisibility, type PhotoInput } from '../lib/posts';
import { BackLink } from '../components/shell/BackLink';
import { AuthSheet } from '../components/auth/AuthSheet';

/**
 * Compose — the create side of the loop (T13-post). A signed-in user photographs a sidequest
 * they went on and posts it; a post IS a completed quest (CLAUDE.md). Photos are required, so
 * the screen won't post without one. Auth is gated at the post action, not the door: a stranger
 * can compose and only meets the AuthSheet when they commit — same "capture intent at its peak"
 * shape as the save flow.
 *
 * On success we land on the new quest's detail, so the poster immediately sees their own post
 * live through the feed's RLS — proof the round-trip worked, and the stamp block they'll build a
 * log from. All XP math is the DB's (create_post); this screen only gathers and hands off.
 *
 * Two modes, one screen. Fresh (`/compose`): a first-of-its-kind post, the author names the
 * quest. Redo (`/compose?templateId=…&questTitle=…`, from "I did this too" on quest detail):
 * a completion of an existing quest — the name is fixed by the template, so we show it instead
 * of asking, and pass the templateId so create_post stamps the next ordinal and rarity climbs.
 */
export default function Compose() {
  const { session } = useSession();
  const params = useLocalSearchParams<{ templateId?: string; questTitle?: string }>();
  const redoTemplateId = params.templateId ?? null;
  const isRedo = redoTemplateId != null;

  const [photo, setPhoto] = useState<PhotoInput | null>(null);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<NewPostVisibility>('public');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  const pickFrom = async (source: 'camera' | 'library') => {
    setError(null);
    try {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError(source === 'camera' ? 'camera access is off — turn it on in settings.' : 'photo access is off — turn it on in settings.');
        return;
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [4, 5] })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [4, 5] });
      if (result.canceled) return;
      const asset = result.assets[0];
      setPhoto({ uri: asset.uri, mimeType: asset.mimeType, width: asset.width, height: asset.height });
    } catch {
      setError('couldn’t open the camera roll — give it another go.');
    }
  };

  const post = async () => {
    if (!photo) return;
    setError(null);
    setPosting(true);
    try {
      const result = await createPost({
        photos: [photo],
        // Redo → the template already names the quest; a fresh post carries the typed name.
        title: isRedo ? null : title,
        caption,
        visibility,
        templateId: redoTemplateId,
      });
      router.replace(`/quest/${result.post.id}`);
    } catch {
      setError('couldn’t post that — give it another go.');
      setPosting(false);
    }
  };

  const onPostPress = () => {
    if (session?.user?.id) post();
    else setShowAuth(true); // a stranger commits → auth → the post completes
  };

  const onAuthed = async () => {
    setShowAuth(false);
    const { data } = await supabase.auth.getSession();
    if (data.session?.user?.id) post();
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.page} contentContainerStyle={styles.scrollContent}>
        <View style={styles.body}>
          <BackLink />
          <Text style={styles.title}>{isRedo ? 'you did this too' : 'post a sidequest'}</Text>
          {isRedo && params.questTitle ? <Text style={styles.redoName}>{params.questTitle}</Text> : null}

          {/* Photo — required. The frame is drawn at the 4:5 the photo will fill, so nothing
              reflows once a photo lands (DESIGN.md → Motion). */}
          {photo ? (
            <View>
              <Image source={{ uri: photo.uri }} style={styles.preview} resizeMode="cover" accessibilityLabel="your photo" />
              <Pressable onPress={() => setPhoto(null)} hitSlop={8}>
                <Text style={styles.replace}>replace photo</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.picker}>
              <Text style={styles.pickerHint}>a post is a photo of a quest you actually did.</Text>
              <View style={styles.pickerButtons}>
                <Pressable style={styles.pickerButton} onPress={() => pickFrom('camera')} accessibilityRole="button">
                  <Text style={styles.pickerLabel}>take a photo</Text>
                </Pressable>
                <Pressable style={styles.pickerButton} onPress={() => pickFrom('library')} accessibilityRole="button">
                  <Text style={styles.pickerLabel}>choose a photo</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* The quest's name. Fresh post only — a redo inherits the template's name (shown
              above), so there's nothing to name. Optional, but it's what a minted template is
              titled (015), so it's the label everyone who redoes this quest will see. */}
          {isRedo ? null : (
            <TextInput
              style={styles.nameField}
              value={title}
              onChangeText={setTitle}
              placeholder="name your quest"
              placeholderTextColor={color.inkMuted}
              maxLength={80}
              accessibilityLabel="quest name"
            />
          )}

          <TextInput
            style={styles.caption}
            value={caption}
            onChangeText={setCaption}
            placeholder="what happened?"
            placeholderTextColor={color.inkMuted}
            multiline
            maxLength={280}
            accessibilityLabel="caption"
          />

          {/* Privacy is per-post (CLAUDE.md). A mono two-state pick, not an account setting. */}
          <View style={styles.visRow}>
            {(['public', 'private'] as const).map((v) => (
              <Pressable key={v} onPress={() => setVisibility(v)} hitSlop={8} accessibilityRole="button">
                <Text style={[styles.visOption, visibility === v && styles.visOptionActive]}>{v.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.actionBar}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          style={[styles.postButton, (!photo || posting) && styles.postButtonDisabled]}
          onPress={onPostPress}
          disabled={!photo || posting}
          accessibilityRole="button"
          accessibilityLabel="post it"
        >
          <Text style={styles.postLabel}>{posting ? 'posting…' : 'post it'}</Text>
        </Pressable>
      </View>

      {showAuth ? <AuthSheet onClose={() => setShowAuth(false)} onAuthed={onAuthed} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.ground },
  page: { flex: 1, backgroundColor: color.ground },
  scrollContent: { paddingBottom: 96 },
  body: {
    paddingHorizontal: layout.pageMargin,
    paddingTop: space.huge,
    gap: space.lg,
  },
  title: { ...type.detailTitle, color: color.ink },
  redoName: { ...type.listTitle, color: color.inkMuted },
  picker: {
    aspectRatio: 4 / 5,
    borderWidth: 1,
    borderColor: color.rule,
    borderRadius: layout.radiusPhoto,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
    paddingHorizontal: space.xl,
  },
  pickerHint: {
    ...type.secondary,
    color: color.inkMuted,
    textAlign: 'center',
    maxWidth: 240,
  },
  pickerButtons: { gap: space.md, alignSelf: 'stretch' },
  pickerButton: {
    height: 48,
    borderRadius: layout.radiusButton,
    borderWidth: 1,
    borderColor: color.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerLabel: { ...type.buttonLabel, color: color.ink },
  preview: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: layout.radiusPhoto,
    backgroundColor: color.rule,
  },
  replace: {
    ...type.dataLine,
    color: color.inkMuted,
    textDecorationLine: 'underline',
    marginTop: space.md,
  },
  nameField: {
    ...type.listTitle,
    color: color.ink,
    borderBottomWidth: 1,
    borderBottomColor: color.rule,
    paddingVertical: space.sm,
  },
  caption: {
    ...type.body,
    color: color.ink,
    minHeight: 72,
    textAlignVertical: 'top',
    borderBottomWidth: 1,
    borderBottomColor: color.rule,
    paddingVertical: space.sm,
  },
  visRow: { flexDirection: 'row', gap: space.xl },
  visOption: { ...type.dataLine, color: color.inkMuted },
  visOptionActive: { color: color.ink },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: layout.pageMargin,
    paddingTop: space.md,
    paddingBottom: space.xxl,
    backgroundColor: color.ground,
    borderTopWidth: 1,
    borderTopColor: color.rule,
    gap: space.sm,
  },
  error: { ...type.secondary, color: color.error },
  postButton: {
    height: 56,
    borderRadius: layout.radiusButton,
    backgroundColor: color.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postButtonDisabled: { opacity: 0.55 },
  postLabel: { ...type.buttonLabel, color: color.ground },
});
