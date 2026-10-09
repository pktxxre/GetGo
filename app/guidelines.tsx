import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { color, layout, space, type } from '../theme/tokens';
import { BackLink } from '../components/shell/BackLink';
import { SUPPORT_EMAIL, contactSupport } from '../lib/support';

/**
 * Community guidelines / content policy — the last piece of the App Store Guideline 1.2 kit
 * (report shipped in 024, block in 025, delete_account in 023). Guideline 1.2 requires a UGC app
 * to publish a policy with a genuine no-tolerance stance on objectionable content, describe the
 * report + block mechanisms, commit to acting on reports, and publish a contact. This screen is
 * all of that in one place; compose links to it as the agreement-at-post-time.
 *
 * Static content, no data — reachable from settings and from the compose agreement line. Voice is
 * the app's: lowercase, blunt-but-kind (DESIGN.md → Voice). No red anywhere (DESIGN colour rule) —
 * the seriousness is carried by the words, not a colour.
 */
const NOT_ALLOWED = [
  'nudity or sexual content',
  'violence, threats, or anything that puts people in danger',
  'hate or harassment of any kind',
  'spam, scams, or fake quests you didn’t do',
  'anything illegal, or impersonating someone else',
];

export default function GuidelinesScreen() {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <BackLink />
      <Text style={styles.title}>community guidelines</Text>

      <Text style={styles.lead}>
        getgo has zero tolerance for objectionable content or abusive behaviour. post real
        sidequests you actually went on. that’s the whole deal.
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>NOT ALLOWED</Text>
        {NOT_ALLOWED.map((line) => (
          <Text key={line} style={styles.item}>
            — {line}
          </Text>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>SEE SOMETHING?</Text>
        <Text style={styles.body}>
          tap <Text style={styles.emph}>report this quest</Text> on any post. we review every report
          and remove content that breaks these rules — usually within 24 hours.
        </Text>
        <Text style={styles.body}>
          don’t want to see someone? open their profile and <Text style={styles.emph}>block</Text>{' '}
          them — their quests disappear from your feed for good.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>IF YOU BREAK THEM</Text>
        <Text style={styles.body}>
          your post comes down. keep breaking them and you lose your account. rating a quest
          critiques the quest, never the person — keep it that way.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>REACH US</Text>
        <Text style={styles.body}>questions, or something we missed?</Text>
        <Pressable onPress={() => contactSupport()} hitSlop={8} accessibilityRole="button">
          <Text style={styles.contact}>{SUPPORT_EMAIL}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.ground },
  content: {
    paddingTop: space.huge,
    paddingHorizontal: layout.pageMargin,
    paddingBottom: space.huge,
    gap: space.xl,
    // Cap the reading measure on wide (web) viewports so body lines don't run the full width —
    // DESIGN typography wants ~45-75 chars. Left-aligned (not centered), no effect on mobile.
    maxWidth: 680,
  },
  title: { ...type.detailTitle, color: color.ink, marginTop: space.md },
  lead: { ...type.body, color: color.ink },
  section: { gap: space.sm },
  sectionLabel: { ...type.microLabel, color: color.inkMuted },
  item: { ...type.body, color: color.ink },
  body: { ...type.body, color: color.ink },
  emph: { color: color.ink, textDecorationLine: 'underline' },
  contact: { ...type.dataLine, color: color.ink, textDecorationLine: 'underline' },
});
