import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { color, layout, space, type } from '../../theme/tokens';
import { useQuest } from '../../hooks/useQuest';
import { useSession } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { isSaved as fetchIsSaved, mintTemplateFromPost, saveQuest } from '../../lib/saves';
import { StateScreen } from '../../components/shell/StateScreen';
import { BackLink } from '../../components/shell/BackLink';
import { StampBlock } from '../../components/quest/StampBlock';
import { SaveStamp } from '../../components/quest/SaveStamp';
import { AuthSheet } from '../../components/auth/AuthSheet';
import { Placeholder } from '../../components/shell/Placeholder';
import { SHELL_COPY } from '../../components/shell/copy';
import { receptionSentence } from '../../lib/format';

export default function QuestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { quest, status, reload } = useQuest(id);
  const { session } = useSession();

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  const templateId = quest?.templateId ?? null;

  // Reflect an existing save when the screen opens signed-in — the stamp is already earned.
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid || !templateId) return;
    let live = true;
    fetchIsSaved(uid, templateId)
      .then((s) => live && setSaved(s))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [session?.user?.id, templateId]);

  const doSave = async (userId: string) => {
    if (!quest) return;
    setSaveError(null);
    setSaving(true);
    try {
      // A first-of-its-kind post has no template yet — mint one so it can be saved (015).
      // Curated/templated posts skip the mint and save directly.
      const tid = templateId ?? (await mintTemplateFromPost(quest.id));
      await saveQuest(userId, tid);
      setSaved(true); // the SaveStamp lands on the stamp block
    } catch {
      setSaveError('couldn’t save — give it another go.');
    } finally {
      setSaving(false);
    }
  };

  const onSavePress = () => {
    const uid = session?.user?.id;
    if (uid) doSave(uid);
    else setShowAuth(true); // a stranger gets the auth sheet, then the save completes
  };

  const onAuthed = async () => {
    setShowAuth(false);
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;
    if (uid) doSave(uid);
  };

  if (status === 'notFound') return <StateScreen kind="notFound" />;
  if (status === 'error') return <StateScreen kind="failed" onPrimary={reload} />;

  // Loading — hero placeholder at the 4:5 the photo will fill, and the stamp block's frame
  // is drawn immediately with placeheld values: "the page arrives as a ticket with the ink
  // not yet dry" (DESIGN.md → Loading). No shimmer.
  if (status === 'loading' || !quest) {
    return (
      <ScrollView style={styles.page} accessibilityLiveRegion="polite">
        <Placeholder aspectRatio={4 / 5} radius={0} />
        <View style={styles.body}>
          <BackLink />
          <Placeholder width="70%" height={30} radius={2} />
          <StampBlock effort={null} nerve={null} costPence={null} ordinal={null} />
          <Text style={styles.loadingLine}>{SHELL_COPY.loading}</Text>
        </View>
      </ScrollView>
    );
  }

  const hero = quest.photos[0];

  return (
    <View style={styles.container}>
      <ScrollView style={styles.page} contentContainerStyle={styles.scrollContent}>
        {/* Hero, full-bleed 4:5, running under the status bar. Nothing floats on it. */}
        {hero ? (
          <Image source={{ uri: hero.uri }} style={styles.hero} resizeMode="cover" accessibilityLabel={quest.caption ?? undefined} />
        ) : (
          <View style={[styles.hero, styles.heroMissing]} />
        )}

        <View style={styles.body}>
          {/* Back is a mono ← BACK on bone below the photo — never over the image. */}
          <BackLink />

          {quest.title ? <Text style={styles.title}>{quest.title}</Text> : null}

          {/* The stamp block is where the save stamp lands (DESIGN.md → Motion). */}
          <View style={styles.stampWrap}>
            <StampBlock effort={quest.effort} nerve={quest.nerve} costPence={quest.costPence} ordinal={quest.ordinal} />
            {saved ? <SaveStamp questId={quest.id} /> : null}
          </View>

          {quest.caption ? <Text style={styles.caption}>{quest.caption}</Text> : null}
          {quest.handle ? (
            quest.authorId ? (
              <Pressable
                onPress={() =>
                  router.push({ pathname: '/user/[id]', params: { id: quest.authorId!, handle: quest.handle! } })
                }
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`see @${quest.handle}'s quests`}
              >
                <Text style={styles.byline}>@{quest.handle}</Text>
              </Pressable>
            ) : (
              <Text style={styles.byline}>@{quest.handle}</Text>
            )
          ) : null}

          {/* Reception is a sentence, not a widget. No hearts, no bars. */}
          <Text style={styles.reception}>{receptionSentence(quest.awesome, quest.couldBeCooler)}</Text>
        </View>
      </ScrollView>

      {/* Sticky bottom bar, ink, one verb. The button itself never animates — the stamp does
          (DESIGN.md → Motion). A signed-out tap opens the auth sheet; a save that can't be
          persisted surfaces inline, next to the action, never as a toast. */}
      <View style={styles.actionBar}>
        {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
        <Pressable
          style={[styles.saveButton, (saved || saving) && styles.saveButtonDisabled]}
          onPress={onSavePress}
          disabled={saved || saving}
          accessibilityRole="button"
          accessibilityLabel="save it"
        >
          <Text style={styles.saveLabel}>{saved ? 'saved' : saving ? 'saving…' : 'save it'}</Text>
        </Pressable>

        {/* The second verb. Only offered once the quest is a real template — a first-of-its-kind
            post is saved first (which mints, 015), then it can be redone. Opens compose in redo
            mode, carrying the template so create_post stamps the next ordinal. */}
        {templateId ? (
          <Pressable
            onPress={() =>
              router.push({ pathname: '/compose', params: { templateId, questTitle: quest.title ?? '' } })
            }
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text style={styles.redoLink}>i did this too</Text>
          </Pressable>
        ) : null}
      </View>

      {showAuth ? <AuthSheet onClose={() => setShowAuth(false)} onAuthed={onAuthed} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: color.ground,
  },
  page: {
    flex: 1,
    backgroundColor: color.ground,
  },
  scrollContent: {
    paddingBottom: 120, // clear the sticky action bar (save it + "i did this too") with room
  },
  hero: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: color.rule,
  },
  heroMissing: {
    backgroundColor: color.rule,
  },
  body: {
    paddingHorizontal: layout.pageMargin,
    paddingTop: space.lg,
    gap: space.lg,
  },
  title: {
    ...type.detailTitle,
    color: color.ink,
  },
  stampWrap: {
    position: 'relative',
  },
  loadingLine: {
    ...type.microLabel,
    color: color.inkMuted,
  },
  caption: {
    ...type.body,
    color: color.ink,
  },
  byline: {
    ...type.secondary,
    color: color.inkMuted,
  },
  reception: {
    ...type.secondary,
    color: color.inkMuted,
  },
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
  saveError: {
    ...type.secondary,
    color: color.error,
  },
  saveButton: {
    height: 56, // DESIGN.md → Quest detail: sticky bottom bar, ink, 56px
    borderRadius: layout.radiusButton,
    backgroundColor: color.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.55,
  },
  saveLabel: {
    ...type.buttonLabel,
    color: color.ground,
  },
  redoLink: {
    ...type.dataLine,
    color: color.inkMuted,
    textDecorationLine: 'underline',
    alignSelf: 'center',
  },
});
