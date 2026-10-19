// ============================================================
// MoneyGuide — Autonomous AI Financial Copilot Modal
// ============================================================
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../../hooks/useTheme';
import { useAppStore } from '../../stores/app-store';
import { sendCopilotMessage, type ChatMessage } from '../../lib/ai/gemini-client';
import {
  executeLogTransactions,
  executeCreateCategory,
  executeSetBudget,
  executeAddSubscription,
} from '../../lib/ai/actions-dispatcher';
import { generateId } from '../../lib/utils';
import type { CopilotActionProposal } from '../../lib/ai/local-engine';
import type { EmergencyHotline } from '../../lib/ai/guardrails';

const QUICK_PROMPTS = [
  'How can I budget wisely?',
  'Review my financial health',
  'Add expense 450 lunch gcash',
  'Set budget for Food to 5000',
  'Add subscription Netflix 549 on day 15',
];

export default function AICopilotModal() {
  const { colors } = useTheme();
  const router = useRouter();
  const { geminiApiKey, setGeminiApiKey } = useAppStore();

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text:
        '👋 Hello! I am your **Moolah Financial Copilot**.\n\nI can directly manage your finances, record transactions, configure monthly category budgets, monitor subscriptions, and provide personalized budgeting coaching (e.g., 50/30/20 rule).\n\n💡 *I work 100% offline using your local SQLite database, or connect to Google Gemini 2.0 when configured.*',
      engine: geminiApiKey ? 'gemini' : 'local',
      timestamp: Date.now(),
      citations: [
        {
          source: 'Moolah Core Safety System',
          note: 'Financial-only scope with verified emergency hotline safeguards',
        },
      ],
    },
  ]);

  // Key config modal state
  const [keyModalVisible, setKeyModalVisible] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(geminiApiKey || '');

  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 150);
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput('');

    const userMsg: ChatMessage = {
      id: generateId(),
      sender: 'user',
      text: query,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const response = await sendCopilotMessage(query, geminiApiKey, messages);

      const botMsg: ChatMessage = {
        id: generateId(),
        sender: 'assistant',
        text: response.text,
        engine: response.engine,
        action: response.action,
        citations: response.citations,
        hotlines: response.hotlines,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: generateId(),
        sender: 'assistant',
        text: `Encountered an unexpected error: ${err?.message || 'Please try again.'}`,
        engine: 'local',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = (messageId: string, action: CopilotActionProposal) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      let successDetail = '';

      if (action.type === 'log_transactions') {
        const items = action.payload.items || [];
        const result = executeLogTransactions(items);
        successDetail = `Recorded ${result.length} transaction(s) into SQLite.`;
      } else if (action.type === 'create_category') {
        const result = executeCreateCategory(action.payload);
        successDetail = `Created "${result.name}" category in SQLite.`;
      } else if (action.type === 'set_budget') {
        const result = executeSetBudget(action.payload);
        successDetail = `Saved monthly budget limit of ₱${result.amount.toLocaleString()} for ${result.category_name}.`;
      } else if (action.type === 'add_subscription') {
        const result = executeAddSubscription(action.payload);
        successDetail = `Added subscription "${result.name}" (₱${result.amount.toLocaleString()}) due on day ${result.billing_day}.`;
      }

      // Mark action as executed in message state
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === messageId && m.action) {
            return {
              ...m,
              action: { ...m.action, executed: true },
            };
          }
          return m;
        })
      );

      // Add confirmation message
      const confirmMsg: ChatMessage = {
        id: generateId(),
        sender: 'system',
        text: `✅ **Action Confirmed & Executed**\n${successDetail}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, confirmMsg]);
    } catch (err: any) {
      Alert.alert('Action Execution Failed', err?.message || 'Could not write to SQLite.');
    }
  };

  const handleSaveApiKey = () => {
    setGeminiApiKey(apiKeyInput.trim());
    setKeyModalVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBadge, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="sparkles" size={20} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Financial Copilot</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setKeyModalVisible(true)}
              style={styles.engineBadge}
            >
              <View
                style={[
                  styles.engineDot,
                  { backgroundColor: geminiApiKey ? '#10B981' : '#8B5CF6' },
                ]}
              />
              <Text style={[styles.engineText, { color: colors.textSecondary }]}>
                {geminiApiKey ? 'Gemini 2.0 (Online)' : 'Local Engine (Offline)'}
              </Text>
              <Ionicons name="settings-outline" size={12} color={colors.textSecondary} style={{ marginLeft: 3 }} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.closeBtn, { backgroundColor: colors.surface }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Messages Stream */}
      <ScrollView
        ref={scrollRef}
        style={styles.chatScroll}
        contentContainerStyle={styles.chatContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((msg, index) => (
          <Animated.View
            key={msg.id}
            entering={FadeInDown.delay(index * 40).duration(250)}
            style={[
              styles.messageRow,
              msg.sender === 'user'
                ? styles.userRow
                : msg.sender === 'system'
                ? styles.systemRow
                : styles.botRow,
            ]}
          >
            {msg.sender === 'assistant' && (
              <View style={[styles.avatar, { backgroundColor: colors.primary + '18' }]}>
                <Ionicons name="sparkles" size={14} color={colors.primary} />
              </View>
            )}

            <View
              style={[
                styles.bubble,
                msg.sender === 'user'
                  ? [styles.userBubble, { backgroundColor: colors.primary }]
                  : msg.sender === 'system'
                  ? [styles.systemBubble, { backgroundColor: '#10B98118', borderColor: '#10B98140' }]
                  : [styles.botBubble, { backgroundColor: colors.surface, borderColor: colors.border }],
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  {
                    color: msg.sender === 'user' ? '#FFFFFF' : colors.text,
                  },
                ]}
              >
                {msg.text}
              </Text>

              {/* Emergency Hotline Alert Banner */}
              {msg.hotlines && msg.hotlines.length > 0 && (
                <View style={styles.hotlinesContainer}>
                  <View style={styles.emergencyHeader}>
                    <Ionicons name="warning" size={18} color="#EF4444" />
                    <Text style={styles.emergencyTitle}>Emergency & Crisis Hotlines</Text>
                  </View>
                  <Text style={styles.emergencySub}>
                    Please reach out immediately to verified emergency responders:
                  </Text>
                  {msg.hotlines.map((hotline: EmergencyHotline, hIdx) => (
                    <TouchableOpacity
                      key={hIdx}
                      style={styles.hotlineCard}
                      onPress={() => Linking.openURL(`tel:${hotline.number.replace(/[^0-9+]/g, '')}`)}
                      activeOpacity={0.8}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.hotlineName}>{hotline.name}</Text>
                        <Text style={styles.hotlineDesc}>{hotline.description} • ({hotline.region})</Text>
                      </View>
                      <View style={styles.callBadge}>
                        <Ionicons name="call" size={14} color="#FFFFFF" />
                        <Text style={styles.callBadgeText}>{hotline.number}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Action Proposal Card */}
              {msg.action && (
                <View
                  style={[
                    styles.actionCard,
                    {
                      backgroundColor: colors.background,
                      borderColor: msg.action.executed ? '#10B981' : colors.primary,
                    },
                  ]}
                >
                  <View style={styles.actionHeader}>
                    <View style={styles.actionHeaderLeft}>
                      <Ionicons
                        name={msg.action.executed ? 'checkmark-circle' : 'flash'}
                        size={18}
                        color={msg.action.executed ? '#10B981' : colors.primary}
                      />
                      <Text style={[styles.actionTitle, { color: colors.text }]}>
                        {msg.action.title}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.actionStatusBadge,
                        {
                          backgroundColor: msg.action.executed ? '#10B98120' : colors.primary + '20',
                          color: msg.action.executed ? '#10B981' : colors.primary,
                        },
                      ]}
                    >
                      {msg.action.executed ? 'Executed' : 'Pending Action'}
                    </Text>
                  </View>

                  <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>
                    {msg.action.description}
                  </Text>

                  {!msg.action.executed && (
                    <TouchableOpacity
                      style={[styles.confirmActionBtn, { backgroundColor: colors.primary }]}
                      onPress={() => handleConfirmAction(msg.id, msg.action!)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.confirmActionBtnText}>Confirm Action</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Citations Pills */}
              {msg.citations && msg.citations.length > 0 && (
                <View style={styles.citationsContainer}>
                  {msg.citations.map((cite, cIdx) => (
                    <View
                      key={cIdx}
                      style={[
                        styles.citationPill,
                        { backgroundColor: colors.background, borderColor: colors.border },
                      ]}
                    >
                      <Ionicons name="bookmark-outline" size={11} color={colors.primary} />
                      <Text style={[styles.citationSource, { color: colors.textSecondary }]}>
                        {cite.source}: <Text style={{ color: colors.textMuted }}>{cite.note}</Text>
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </Animated.View>
        ))}

        {loading && (
          <Animated.View entering={FadeInUp.duration(200)} style={styles.loadingRow}>
            <View style={[styles.avatar, { backgroundColor: colors.primary + '18' }]}>
              <Ionicons name="sparkles" size={14} color={colors.primary} />
            </View>
            <View style={[styles.loadingBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Analyzing request & finances...
              </Text>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* Quick Prompts Bar */}
      <View style={[styles.quickPromptsWrap, { borderTopColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickPromptsList}>
          {QUICK_PROMPTS.map((prompt, pIdx) => (
            <TouchableOpacity
              key={pIdx}
              style={[styles.quickPromptChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => handleSend(prompt)}
              activeOpacity={0.7}
            >
              <Ionicons name="bulb-outline" size={13} color={colors.primary} style={{ marginRight: 5 }} />
              <Text style={[styles.quickPromptText, { color: colors.text }]}>{prompt}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Input Bar */}
      <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <TextInput
          style={[styles.textInput, { color: colors.text }]}
          placeholder="Ask finances or tell me an action..."
          placeholderTextColor={colors.textMuted}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => handleSend()}
          returnKeyType="send"
          multiline={false}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            { backgroundColor: input.trim() ? colors.primary : colors.surfaceAlt },
          ]}
          disabled={!input.trim() || loading}
          onPress={() => handleSend()}
        >
          <Ionicons
            name="arrow-up"
            size={18}
            color={input.trim() ? '#FFFFFF' : colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      {/* Gemini API Key Modal */}
      <Modal visible={keyModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Google Gemini API Key</Text>
              <TouchableOpacity onPress={() => setKeyModalVisible(false)}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalHelp, { color: colors.textSecondary }]}>
              Moolah includes an autonomous **Local Offline Engine** that works without any internet or key.
              {'\n\n'}
              If you have a Google AI Studio key, paste it here to activate cloud Gemini 2.0 model reasoning.
            </Text>

            <TextInput
              style={[styles.keyInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="AIzaSy..."
              placeholderTextColor={colors.textMuted}
              value={apiKeyInput}
              onChangeText={setApiKeyInput}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalSecondaryBtn, { borderColor: colors.border }]}
                onPress={() => {
                  setApiKeyInput('');
                  setGeminiApiKey('');
                  setKeyModalVisible(false);
                }}
              >
                <Text style={{ color: '#EF4444', fontWeight: '600' }}>Clear / Offline Only</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalPrimaryBtn, { backgroundColor: colors.primary }]}
                onPress={handleSaveApiKey}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Save Key</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 14 : 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  engineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  engineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  engineText: {
    fontSize: 11,
    fontWeight: '500',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatScroll: {
    flex: 1,
  },
  chatContent: {
    padding: 16,
    gap: 14,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  botRow: {
    justifyContent: 'flex-start',
  },
  systemRow: {
    justifyContent: 'center',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: 16,
    padding: 14,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  botBubble: {
    borderWidth: 1,
    borderBottomLeftRadius: 4,
  },
  systemBubble: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '92%',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 21,
  },
  hotlinesContainer: {
    marginTop: 12,
    backgroundColor: '#EF444415',
    borderWidth: 1,
    borderColor: '#EF444450',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  emergencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emergencyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
  },
  emergencySub: {
    fontSize: 12,
    color: '#EF4444',
    opacity: 0.9,
    marginBottom: 4,
  },
  hotlineCard: {
    backgroundColor: '#EF444425',
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  hotlineName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  hotlineDesc: {
    fontSize: 10,
    color: '#EF4444',
    opacity: 0.85,
    marginTop: 1,
  },
  callBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  callBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  actionCard: {
    marginTop: 12,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  actionStatusBadge: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  actionDesc: {
    fontSize: 12,
  },
  confirmActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 8,
    gap: 6,
    marginTop: 4,
  },
  confirmActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  citationsContainer: {
    marginTop: 10,
    gap: 4,
  },
  citationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 5,
  },
  citationSource: {
    fontSize: 10,
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingBubble: {
    borderWidth: 1,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
  },
  quickPromptsWrap: {
    borderTopWidth: 1,
    paddingVertical: 8,
  },
  quickPromptsList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  quickPromptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  quickPromptText: {
    fontSize: 12,
    fontWeight: '500',
  },
  inputContainer: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 8,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  modalHelp: {
    fontSize: 13,
    lineHeight: 18,
  },
  keyInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  modalSecondaryBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  modalPrimaryBtn: {
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
});
