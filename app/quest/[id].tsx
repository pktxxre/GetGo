import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { color, layout, space, type } from '../../theme/tokens';
import { useQuest } from '../../hooks/useQuest';
import { useSession } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { isSaved as fetchIsSaved, mintTemplateFromPost, saveQuest } from '../../lib/saves';
import { castRating, fetchMyRating, retractRating, type RatingValue } from '../../lib/ratings';
import { StateScreen } from '../../components/shell/StateScreen';
import { BackLink } from '../../components/shell/BackLink';
import { GradedImage } from '../../components/GradedImage';
import { StampBlock } from '../../components/quest/StampBlock';
import { SaveStamp } from '../../components/quest/SaveStamp';
import { AuthSheet } from '../../components/auth/AuthSheet';
import { ReportSheet } from '../../components/quest/ReportSheet';
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

  // Reception is kept in local state so a cast rating updates the sentence live. Seeded from the
  // fetched quest (which already includes every visible rating, mine included), then nudged by
  // the delta of each cast/switch/retract — no refetch, no double-count.
  const [awesome, setAwesome] = useState(0);
  const [couldBeCooler, setCouldBeCooler] = useState(0);
  const [myRating, setMyRating] = useState<RatingValue | null>(null);
  const [rateError, setRateError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

  const templateId = quest?.templateId ?? null;
  const uid = session?.user?.id;
  // Rating critiques the quest, never the person: only a signed-in viewer who isn't the author
  // can rate (mirrors the 005 RLS — no self-rating). A stranger gets exactly one verb (save it).
  const canRate = !!uid && !!quest && uid !== quest.authorId;

  // Seed the reception counts once the quest resolves.
  useEffect(() => {
    if (!quest) return;
    setAwesome(quest.awesome);
    setCouldBeCooler(quest.couldBeCooler);
  }, [quest?.id, quest?.awesome, quest?.couldBeCooler]);

  // Reflect an existing rating so the right button reads as active on open.
  useEffect(() => {
    if (!uid || !quest || uid === quest.authorId) return;
    let live = true;
    fetchMyRating(quest.id, uid)
      .then((v) => live && setMyRating(v))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [uid, quest?.id, quest?.authorId]);

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

  // Tapping a rating: the one you already picked retracts it, the other switches. Optimistic —
  // the sentence moves immediately; a failed write reverts and surfaces inline (never a toast).
  const onRate = async (value: RatingValue) => {
    if (!uid || !quest) return;
    const prev = myRating;
    const next = prev === value ? null : value; // re-tap = retract
    const shift = (from: RatingValue | null, to: RatingValue | null) => {
      setAwesome((a) => a - (from === 'awesome' ? 1 : 0) + (to === 'awesome' ? 1 : 0));
      setCouldBeCooler((c) => c - (from === 'could_be_cooler' ? 1 : 0) + (to === 'could_be_cooler' ? 1 : 0));
    };
    setRateError(null);
    shift(prev, next);
    setMyRating(next);
    try {
      if (next === null) await retractRating(quest.id, uid);
      else await castRating(quest.id, uid, value);
    } catch {
      shift(next, prev); // put the counts back
      setMyRating(prev);
      setRateError('couldn’t save that — give it another go.');
    }
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
          <GradedImage source={{ uri: hero.uri }} style={styles.hero} accessibilityLabel={quest.caption ?? undefined} />
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

          {/* Reception is a sentence, not a widget. No hearts, no bars. Live off local counts so
              a cast rating updates it immediately. */}
          <Text style={styles.reception}>{receptionSentence(awesome, couldBeCooler)}</Text>

          {/* The two rating buttons — critique the quest, never the person. Ink, 4px (not pills,
              DESIGN → Deleted on purpose), in the body: the sticky bar's one verb stays `save it`.
              Hidden for a stranger and for the author (RLS blocks self-rating anyway). */}
          {canRate ? (
            <View style={styles.rate}>
              <View style={styles.rateRow}>
                {(['awesome', 'could_be_cooler'] as RatingValue[]).map((value) => {
                  const active = myRating === value;
                  const label = value === 'awesome' ? 'awesome' : 'could be cooler';
                  return (
                    <Pressable
                      key={value}
                      onPress={() => onRate(value)}
                      style={[styles.rateButton, active && styles.rateButtonActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={label}
                    >
                      <Text style={[styles.rateLabel, active && styles.rateLabelActive]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {rateError ? <Text style={styles.saveError}>{rateError}</Text> : null}
            </View>
          ) : null}

          {/* The report affordance (W3 / Guideline 1.2). Deliberately understated and below the
              fold — a muted mono link, not chrome in the first viewport. Signed-in non-author only
              (a stranger gets the one verb; the author would delete, not flag; RLS blocks both). */}
          {canRate ? (
            <Pressable onPress={() => setShowReport(true)} hitSlop={8} accessibilityRole="button">
              <Text style={styles.report}>report this quest</Text>
            </Pressable>
          ) : null}
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
            mode, carrying the template so create_post stamps the next ordinal. Signed-in only:
            DESIGN → Quest detail says a stranger gets exactly one verb (`save it`); a signed-out
            visitor must not see this second verb. */}
        {templateId && uid ? (
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
      {showReport && uid ? (
        <ReportSheet postId={quest.id} reporterId={uid} onClose={() => setShowReport(false)} />
      ) : null}
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
  rate: {
    gap: space.sm,
  },
  rateRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
  rateButton: {
    borderWidth: 1,
    borderColor: color.ink,
    borderRadius: layout.radiusButton, // 4px — not a pill
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  rateButtonActive: {
    backgroundColor: color.ink,
  },
  rateLabel: {
    ...type.buttonLabel,
    color: color.ink,
  },
  rateLabelActive: {
    color: color.ground,
  },
  report: {
    ...type.dataLine,
    color: color.inkMuted,
    textDecorationLine: 'underline',
    marginTop: space.sm,
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
