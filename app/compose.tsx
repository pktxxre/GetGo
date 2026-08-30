import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { color, layout, space, type } from '../theme/tokens';
import { useSession } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { createPost, poundsToPence, type NewPostVisibility, type PhotoInput } from '../lib/posts';
import { captureLocation, type CapturedLocation } from '../lib/location';
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
  // The author's classification (016). Effort/nerve are 1..3 tiers, null = unclassified (the
  // stamp shows "—"). Cost is a raw pounds string until post time, then → pence. Fresh posts
  // only: a redo inherits the template's axes, so these are never sent in redo mode.
  const [effort, setEffort] = useState<number | null>(null);
  const [nerve, setNerve] = useState<number | null>(null);
  const [cost, setCost] = useState('');
  // Where it happened (019) — captured opt-in from device location. Fresh posts only.
  const [location, setLocation] = useState<CapturedLocation | null>(null);
  const [locating, setLocating] = useState(false);
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

  const addLocation = async () => {
    if (locating) return;
    setError(null);
    setLocating(true);
    try {
      const loc = await captureLocation();
      if (loc) setLocation(loc);
      else setError('location is off — turn it on in settings, or post without it.');
    } finally {
      setLocating(false);
    }
  };

  const post = async () => {
    if (!photo) return;
    setError(null);
    setPosting(true);
    try {
      const result = await createPost({
        photos: [photo],
        // Redo → the template already names and classifies the quest; a fresh post carries the
        // typed name and the author's effort/nerve/cost.
        title: isRedo ? null : title,
        caption,
        visibility,
        templateId: redoTemplateId,
        effort: isRedo ? null : effort,
        nerve: isRedo ? null : nerve,
        costPence: isRedo ? null : poundsToPence(cost),
        // A redo inherits the quest's location from its template; a fresh post carries its own.
        lon: isRedo ? null : location?.lon ?? null,
        lat: isRedo ? null : location?.lat ?? null,
        neighbourhood: isRedo ? null : location?.neighbourhood ?? null,
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

          {/* Classify the quest on its axes (016) — effort/nerve/cost, not one good/bad line.
              What the author picks here is copied onto the template when someone first saves
              this post (018), so it's what fills the stamp block for everyone who follows.
              Fresh post only; a redo inherits the existing quest's axes. Optional — an unset
              axis reads "—" rather than a guess. */}
          {isRedo ? null : (
            <View style={styles.classify}>
              <TierRow label="effort" value={effort} onPick={setEffort} />
              <TierRow label="nerve" value={nerve} onPick={setNerve} />
              <View style={styles.classifyRow}>
                <Text style={styles.classifyLabel}>COST</Text>
                <View style={styles.costField}>
                  <Text style={styles.costPrefix}>£</Text>
                  <TextInput
                    style={styles.costInput}
                    value={cost}
                    onChangeText={setCost}
                    placeholder="0"
                    placeholderTextColor={color.inkMuted}
                    keyboardType="decimal-pad"
                    maxLength={7}
                    accessibilityLabel="cost in pounds"
                  />
                </View>
              </View>

              {/* Where it happened (019). Opt-in: tap to attach device location → fills the
                  fact line's neighbourhood. Tapping the captured value again clears it. */}
              <View style={styles.classifyRow}>
                <Text style={styles.classifyLabel}>WHERE</Text>
                {location ? (
                  <Pressable onPress={() => setLocation(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel="clear location">
                    <Text style={styles.tierOptionActive}>
                      {(location.neighbourhood ?? 'located').toUpperCase()}
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={addLocation} hitSlop={8} disabled={locating} accessibilityRole="button" accessibilityLabel="add location">
                    <Text style={styles.tierOption}>{locating ? 'LOCATING…' : 'ADD LOCATION'}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}

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

/** One classification axis: a mono label + a low/mid/high tap-pick (1..3). Tapping the active
 *  tier again clears it back to unset, so the author can undo a mis-tap to "—". */
function TierRow({
  label,
  value,
  onPick,
}: {
  label: string;
  value: number | null;
  onPick: (tier: number | null) => void;
}) {
  const tiers: [string, number][] = [
    ['low', 1],
    ['mid', 2],
    ['high', 3],
  ];
  return (
    <View style={styles.classifyRow}>
      <Text style={styles.classifyLabel}>{label.toUpperCase()}</Text>
      <View style={styles.tierOptions}>
        {tiers.map(([word, tier]) => (
          <Pressable
            key={tier}
            onPress={() => onPick(value === tier ? null : tier)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${label} ${word}`}
          >
            <Text style={[styles.tierOption, value === tier && styles.tierOptionActive]}>
              {word.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.ground },
  page: { flex: 1, backgroundColor: color.ground },
  scrollContent: { paddingBottom: 120 }, // clear the sticky "post it" bar with room to spare
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
  classify: { gap: space.md },
  classifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  classifyLabel: { ...type.microLabel, color: color.inkMuted },
  tierOptions: { flexDirection: 'row', gap: space.lg },
  tierOption: { ...type.dataLine, color: color.inkMuted },
  tierOptionActive: { color: color.ink },
  costField: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  costPrefix: { ...type.dataLine, color: color.inkMuted },
  costInput: { ...type.dataLine, color: color.ink, minWidth: 56, textAlign: 'right', padding: 0 },
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
