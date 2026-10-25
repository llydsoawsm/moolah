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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { useAppStore } from '../../stores/app-store';
import { sendCopilotMessage, type ChatMessage } from '../../lib/ai/gemini-client';
import {
  executeLogTransactions,
  executeCreateCategory,
  executeSetBudget,
  executeAddSubscription,
  executeCopilotAction,
} from '../../lib/ai/actions-dispatcher';
import {
  getOrCreateActiveSession,
  createNewSession,
  loadSessionMessages,
  persistMessage,
  getUserSessions,
  deleteSession,
  type ChatSessionMeta,
} from '../../lib/ai/chat-sessions';
import { generateId, formatDate } from '../../lib/utils';
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
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'ios' ? 52 : 24);
  // Ensure optimal contrast for text/icons on top of colors.primary across themes
  const isLightPrimary = colors.primary.toLowerCase() === '#fafafa' || colors.statusBar === 'light';
  const primaryTextColor = isLightPrimary ? '#09090B' : '#FFFFFF';

  const router = useRouter();
  const currentUser = useAppStore((s) => s.currentUser);
  const userId = currentUser?.id || 'guest';
  const { geminiApiKey, geminiModel } = useAppStore();
  const setGeminiApiKey = useAppStore((s) => s.setGeminiApiKey);
  const [apiKeyModalVisible, setApiKeyModalVisible] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(geminiApiKey || '');

  const [sessionId, setSessionId] = useState<string>('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // History sessions modal state
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [sessionList, setSessionList] = useState<ChatSessionMeta[]>([]);

  const scrollRef = useRef<ScrollView>(null);

  // Load or create session for the current authenticated user
  useEffect(() => {
    const sid = getOrCreateActiveSession(userId);
    setSessionId(sid);
    const stored = loadSessionMessages(sid);
    if (stored.length > 0) {
      setMessages(stored);
    } else {
      const welcome: ChatMessage = {
        id: 'welcome',
        sender: 'assistant',
        text: '👋 Hi! I am your Moolah Copilot. Ask me about your finances or tell me to log expenses, set budgets, and track bills.',
        engine: geminiApiKey ? 'gemini' : 'local',
        timestamp: Date.now(),
      };
      setMessages([welcome]);
      persistMessage(sid, userId, welcome);
    }
  }, [userId]);

  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 150);
  }, [messages, loading]);

  const handleNewSession = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newSid = createNewSession(userId);
    setSessionId(newSid);
    const welcome: ChatMessage = {
      id: generateId(),
      sender: 'assistant',
      text: 'New session started. How can I assist with your finances?',
      engine: 'gemini',
      timestamp: Date.now(),
    };
    setMessages([welcome]);
    persistMessage(newSid, userId, welcome);
    setHistoryModalVisible(false);
  };

  const handleOpenHistory = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSessionList(getUserSessions(userId));
    setHistoryModalVisible(true);
  };

  const handleSelectSession = (sid: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSessionId(sid);
    const stored = loadSessionMessages(sid);
    if (stored.length > 0) {
      setMessages(stored);
    } else {
      const welcome: ChatMessage = {
        id: generateId(),
        sender: 'assistant',
        text: '👋 Hi! How can I assist with your finances in this session?',
        engine: 'gemini',
        timestamp: Date.now(),
      };
      setMessages([welcome]);
    }
    setHistoryModalVisible(false);
  };

  const handleDeleteSession = (sid: string, title: string) => {
    Alert.alert(
      'Delete Chat Session',
      `Are you sure you want to delete "${title || 'this conversation'}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteSession(sid);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            const remaining = getUserSessions(userId);
            setSessionList(remaining);
            if (sid === sessionId) {
              if (remaining.length > 0) {
                handleSelectSession(remaining[0].id);
              } else {
                handleNewSession();
              }
            }
          },
        },
      ]
    );
  };

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput('');

    const activeSid = sessionId || getOrCreateActiveSession(userId);
    if (!sessionId) setSessionId(activeSid);

    const userMsg: ChatMessage = {
      id: generateId(),
      sender: 'user',
      text: query,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    persistMessage(activeSid, userId, userMsg);
    setLoading(true);

    try {
      const response = await sendCopilotMessage(query, geminiApiKey, messages, geminiModel);

      // AI Agent Full Control: Auto-execute the action directly into the system/SQLite
      let processedAction = response.action;
      if (response.action) {
        try {
          executeCopilotAction(response.action);
          processedAction = { ...response.action, executed: true };
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (actErr: any) {
          console.warn('Action auto-execution error:', actErr);
        }
      }

      const botMsg: ChatMessage = {
        id: generateId(),
        sender: 'assistant',
        text: response.text,
        engine: response.engine,
        action: processedAction,
        hotlines: response.hotlines,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, botMsg]);
      persistMessage(activeSid, userId, botMsg);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: generateId(),
        sender: 'assistant',
        text: `Error: ${err?.message || 'Please try again.'}`,
        engine: 'local',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      persistMessage(activeSid, userId, errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = (messageId: string, action: CopilotActionProposal) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const detail = executeCopilotAction(action);

      // Mark action as executed in message state
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === messageId && m.action) {
            const updated = {
              ...m,
              action: { ...m.action, executed: true },
            };
            if (sessionId) persistMessage(sessionId, userId, updated);
            return updated;
          }
          return m;
        })
      );

      // Add confirmation message
      const confirmMsg: ChatMessage = {
        id: generateId(),
        sender: 'system',
        text: `✅ **Action Executed**\n${detail}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, confirmMsg]);
      if (sessionId) persistMessage(sessionId, userId, confirmMsg);
    } catch (err: any) {
      Alert.alert('Action Execution Failed', err?.message || 'Could not execute system action.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: topPadding }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBadge, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="sparkles" size={20} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Financial Copilot</Text>
            <View style={styles.engineBadge}>
              <View style={[styles.engineDot, { backgroundColor: '#10B981' }]} />
              <Text style={[styles.engineText, { color: colors.textSecondary }]}>
                Gemini 3.8
              </Text>
            </View>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            onPress={() => {
              setTempApiKey(geminiApiKey || '');
              setApiKeyModalVisible(true);
            }}
            style={[styles.closeBtn, { backgroundColor: colors.surface }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Gemini API Key"
          >
            <Ionicons name="key-outline" size={17} color={geminiApiKey ? '#10B981' : colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleOpenHistory}
            style={[styles.closeBtn, { backgroundColor: colors.surface }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Chat History"
          >
            <Ionicons name="time-outline" size={19} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleNewSession}
            style={[styles.closeBtn, { backgroundColor: colors.surface }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="New Chat"
          >
            <Ionicons name="create-outline" size={19} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.closeBtn, { backgroundColor: colors.surface }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
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
                    color: msg.sender === 'user' ? primaryTextColor : colors.text,
                    fontWeight: msg.sender === 'user' ? '600' : '400',
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
                      <Ionicons name="checkmark-circle-outline" size={16} color={primaryTextColor} />
                      <Text style={[styles.confirmActionBtnText, { color: primaryTextColor }]}>Confirm Action</Text>
                    </TouchableOpacity>
                  )}
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
            color={input.trim() ? primaryTextColor : colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      {/* History Sessions Modal */}
      <Modal visible={historyModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.historyModalBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.historyIconBadge, { backgroundColor: colors.primary + '20' }]}>
                  <Ionicons name="time" size={18} color={colors.primary} />
                </View>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Chat History</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>
                    {sessionList.length} conversation{sessionList.length === 1 ? '' : 's'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setHistoryModalVisible(false)}
                style={[styles.closeBtn, { backgroundColor: colors.surfaceAlt }]}
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Start New Chat Button */}
            <TouchableOpacity
              style={[styles.newChatRow, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '40' }]}
              onPress={handleNewSession}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle" size={20} color={colors.primary} />
              <Text style={[styles.newChatRowText, { color: colors.primary }]}>Start New Conversation</Text>
            </TouchableOpacity>

            {/* Sessions List */}
            <ScrollView
              style={styles.historyListScroll}
              contentContainerStyle={{ paddingBottom: 16, gap: 10 }}
              showsVerticalScrollIndicator={false}
            >
              {sessionList.length === 0 ? (
                <View style={styles.emptyHistoryWrap}>
                  <Ionicons name="chatbubbles-outline" size={44} color={colors.textMuted} />
                  <Text style={[styles.emptyHistoryText, { color: colors.textMuted }]}>
                    No chat sessions yet.
                  </Text>
                </View>
              ) : (
                sessionList.map((item) => {
                  const isActive = item.id === sessionId;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.sessionItem,
                        {
                          backgroundColor: isActive ? colors.surfaceAlt : colors.background,
                          borderColor: isActive ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => handleSelectSession(item.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.sessionItemLeft}>
                        <View
                          style={[
                            styles.sessionDot,
                            { backgroundColor: isActive ? colors.primary : colors.border },
                          ]}
                        />
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.sessionTitle,
                                {
                                  color: colors.text,
                                  fontWeight: isActive ? '700' : '600',
                                },
                              ]}
                            >
                              {item.title}
                            </Text>
                            {isActive && (
                              <View style={[styles.activePill, { backgroundColor: colors.primary }]}>
                                <Text style={[styles.activePillText, { color: primaryTextColor }]}>Active</Text>
                              </View>
                            )}
                          </View>

                          {item.last_message ? (
                            <Text
                              numberOfLines={1}
                              style={[styles.sessionPreview, { color: colors.textSecondary }]}
                            >
                              {item.last_message}
                            </Text>
                          ) : null}

                          <Text style={[styles.sessionMeta, { color: colors.textMuted }]}>
                            {item.message_count || 0} messages • {item.updated_at ? formatDate(item.updated_at) : 'Recent'}
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        onPress={() => handleDeleteSession(item.id, item.title)}
                        style={styles.sessionDeleteBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="trash-outline" size={17} color={colors.textMuted} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Gemini API Key Configuration Modal */}
      <Modal
        visible={apiKeyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setApiKeyModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.historyModalBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.historyIconBadge, { backgroundColor: '#10B98120' }]}>
                  <Ionicons name="key-outline" size={18} color="#10B981" />
                </View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Gemini AI API Key</Text>
              </View>
              <TouchableOpacity onPress={() => setApiKeyModalVisible(false)}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
              Enter your Google Gemini API key to enable live cloud AI intelligence. You can get a free key from{' '}
              <Text
                style={{ color: colors.primary, textDecorationLine: 'underline' }}
                onPress={() => Linking.openURL('https://aistudio.google.com/')}
              >
                aistudio.google.com
              </Text>.
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>
              Leave empty to use the built-in smart local financial engine.
            </Text>

            <TextInput
              style={{
                height: 48,
                borderRadius: 12,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.border,
                paddingHorizontal: 14,
                color: colors.text,
                fontSize: 15,
                backgroundColor: colors.surfaceAlt,
              }}
              placeholder="Paste AIzaSy... API Key"
              placeholderTextColor={colors.textMuted}
              value={tempApiKey}
              onChangeText={setTempApiKey}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
              <TouchableOpacity
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                onPress={() => setApiKeyModalVisible(false)}
              >
                <Text style={{ color: colors.text, fontWeight: '500' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  paddingHorizontal: 18,
                  paddingVertical: 10,
                  borderRadius: 10,
                  backgroundColor: colors.text,
                }}
                onPress={() => {
                  setGeminiApiKey(tempApiKey.trim());
                  setApiKeyModalVisible(false);
                  Alert.alert('Saved', tempApiKey.trim() ? 'Gemini API Key saved!' : 'Switched to local financial engine.');
                }}
              >
                <Text style={{ color: colors.background, fontWeight: '700' }}>Save Key</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    fontSize: 16,
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
  historyModalBox: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  historyIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newChatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  newChatRowText: {
    fontSize: 14,
    fontWeight: '700',
  },
  historyListScroll: {
    maxHeight: 380,
  },
  emptyHistoryWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyHistoryText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  sessionItemLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
    paddingRight: 8,
  },
  sessionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  sessionTitle: {
    fontSize: 14,
    flexShrink: 1,
  },
  activePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activePillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  sessionPreview: {
    fontSize: 12,
    marginTop: 2,
  },
  sessionMeta: {
    fontSize: 11,
    marginTop: 4,
  },
  sessionDeleteBtn: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
});
