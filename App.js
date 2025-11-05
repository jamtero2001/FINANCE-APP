import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ScrollView,
  Pressable,
  Image,
  Modal,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  NativeModules,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle, G } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { supabase, isSupabaseConfigured } from './supabaseClient';

const screenWidth = Dimensions.get('window').width;
const donutSize = Math.min(screenWidth * 0.48, 220);
const donutStrokeWidth = 18;
const donutRadius = donutSize / 2;
const circumference = 2 * Math.PI * (donutRadius - donutStrokeWidth / 2);

const TRANSACTIONS_CACHE_KEY = 'pf_transactions_v1';
const OCR_ITEMS_CACHE_KEY = 'pf_ocr_items_v1';

const summary = {
  balance: 5200.5,
  weeklyChange: 250.75,
};

const categories = [
  { id: 'housing', label: 'Housing', value: 25, color: '#1f6f4d' },
  { id: 'food', label: 'Food', value: 30, color: '#2f8e58' },
  { id: 'transport', label: 'Transport', value: 22, color: '#4da673' },
  { id: 'fun', label: 'Fun', value: 23, color: '#72c68f' },
];

const transactions = [
  { id: '1', icon: 'shopping-bag', label: 'Grocery Store', amount: -75.3 },
  { id: '2', icon: 'home', label: 'Rent Payment', amount: -11200 },
  { id: '3', icon: 'coffee', label: 'Café', amount: -5.5 },
  { id: '4', icon: 'dollar-sign', label: 'Salary', amount: 3200 },
];

const VisionKitOcr = NativeModules?.VisionKitOcr;

const formatCurrency = (amount) =>
  `$${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatChange = (amount) => `${amount >= 0 ? '+' : ''}${formatCurrency(amount)}`;

export default function App() {
  const [isFabMenuOpen, setFabMenuOpen] = useState(false);
  const [isOcrModalVisible, setOcrModalVisible] = useState(false);
  const [isOcrLoading, setOcrLoading] = useState(false);
  const [ocrItems, setOcrItems] = useState([]);
  const [pendingItems, setPendingItems] = useState([]);
  const [ocrError, setOcrError] = useState(null);
  const [transactionsList, setTransactionsList] = useState(transactions);
  const [isManualModalVisible, setManualModalVisible] = useState(false);
  const [manualDescription, setManualDescription] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualPayee, setManualPayee] = useState('');
  const [manualCategoryId, setManualCategoryId] = useState(null);
  const [isCategoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [manualDate, setManualDate] = useState(new Date());

  const currencySymbol = '€';
  const formatShortDate = (d) => {
    try {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return '';
    }
  };
  
  const loadTransactions = async () => {
    try {
      if (!isSupabaseConfigured || !supabase) return;
      const { data, error } = await supabase
        .from('transactions')
        .select('id,label,amount,icon,transaction_at')
        .order('transaction_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      const mapped = (data || []).map((row) => ({
        id: String(row.id),
        icon: row.icon || 'shopping-bag',
        label: row.label,
        amount: Number(row.amount),
      }));
      setTransactionsList(mapped);
    } catch (e) {
      console.error('Load transactions error', e);
    }
  };

  const loadCachedTransactions = async () => {
    try {
      const json = await AsyncStorage.getItem(TRANSACTIONS_CACHE_KEY);
      if (json) {
        const cached = JSON.parse(json);
        if (Array.isArray(cached)) {
          setTransactionsList(cached);
        }
      }
    } catch (e) {
      console.error('Load transactions cache error', e);
    }
  };

  const loadCachedOcrItems = async () => {
    try {
      const json = await AsyncStorage.getItem(OCR_ITEMS_CACHE_KEY);
      if (json) {
        const cached = JSON.parse(json);
        if (Array.isArray(cached)) {
          setOcrItems(cached);
        }
      }
    } catch (e) {
      console.error('Load OCR cache error', e);
    }
  };

  useEffect(() => {
    loadCachedTransactions();
    loadCachedOcrItems();
    loadTransactions();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(TRANSACTIONS_CACHE_KEY, JSON.stringify(transactionsList)).catch((e) =>
      console.error('Save transactions cache error', e),
    );
  }, [transactionsList]);

  useEffect(() => {
    AsyncStorage.setItem(OCR_ITEMS_CACHE_KEY, JSON.stringify(ocrItems)).catch((e) =>
      console.error('Save OCR cache error', e),
    );
  }, [ocrItems]);
  
  const handleConnectPress = async () => {
    try {
      if (!isSupabaseConfigured || !supabase) {
        Alert.alert(
          'Supabase not configured',
          'Add your EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (or set expo.extra.supabaseUrl/AnonKey in app.json), then reload.'
        );
        return;
      }
      const testTable = process.env.EXPO_PUBLIC_SUPABASE_TEST_TABLE || Constants.expoConfig?.extra?.supabaseTestTable;
      if (!testTable) {
        Alert.alert(
          'Set a test table',
          'Provide EXPO_PUBLIC_SUPABASE_TEST_TABLE or expo.extra.supabaseTestTable in app.json to run a sample fetch.'
        );
        return;
      }
      const { data, error } = await supabase.from(testTable).select('*').limit(5);
      if (error) throw error;
      console.log('Supabase sample rows:', data);
      Alert.alert('Supabase OK', `Fetched ${data?.length || 0} rows from ${testTable}.`);
    } catch (e) {
      console.error('Supabase test error', e);
      Alert.alert('Supabase error', e.message || 'Unknown error');
    }
  };
  
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => isFabMenuOpen && setFabMenuOpen(false)}>
          <View style={styles.screenWrapper}>
            <View style={{ marginTop: 16 }}>
              <View style={styles.headerTopRow}>
                <TouchableOpacity style={styles.headerConnectButton} onPress={handleConnectPress}>
                  <Image
                    source={require('./assets/mercado-pago-logo.png')}
                    style={styles.headerConnectLogo}
                  />
                  <Text style={styles.headerConnectText}>Connect Mercado Pago</Text>
                </TouchableOpacity>
              </View>
            </View>

          <View style={styles.tabBar}>
            <TouchableOpacity style={styles.tabChipActive}>
              <Text style={styles.tabChipTextActive}>Transactions</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabChip}>
              <Text style={styles.tabChipText}>Overview</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabChip}>
              <Text style={styles.tabChipText}>Budget</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.contentCard}>
            <Text style={styles.sectionTitle}>Expenses by Category</Text>
            <View style={styles.donutWrapper}>
              <View style={styles.donutStack}>
                <Svg width={donutSize} height={donutSize}>
                  <G rotation="-90" origin={`${donutSize / 2}, ${donutSize / 2}`}>
                    <Circle
                      cx={donutSize / 2}
                      cy={donutSize / 2}
                      r={donutRadius - donutStrokeWidth / 2}
                      stroke="#dcefe4"
                      strokeWidth={donutStrokeWidth}
                      fill="transparent"
                    />
                    {categories
                      .reduce((segments, category) => {
                        const accumulated = segments.reduce((total, seg) => total + seg.value, 0);
                        return [
                          ...segments,
                          {
                            value: category.value,
                            color: category.color,
                            offset: circumference - (accumulated / 100) * circumference,
                          },
                        ];
                      }, [])
                      .map((segment, index) => (
                        <Circle
                          key={`${segment.color}-${index}`}
                          cx={donutSize / 2}
                          cy={donutSize / 2}
                          r={donutRadius - donutStrokeWidth / 2}
                          stroke={segment.color}
                          strokeWidth={donutStrokeWidth}
                          strokeDasharray={`${circumference} ${circumference}`}
                          strokeDashoffset={segment.offset}
                          strokeLinecap="round"
                          fill="transparent"
                        />
                      ))}
                  </G>
                </Svg>
                <View style={styles.donutCenter}>
                  <Text style={styles.donutCenterLabel}>Expenses</Text>
                  <Text style={styles.donutCenterValue}>{formatCurrency(summary.weeklyChange)}</Text>
                </View>
              </View>
              <View style={styles.legend}>
                {categories.map((category) => (
                  <View key={category.id} style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: category.color }]} />
                    <Text style={styles.legendLabel}>{category.label}</Text>
                    <Text style={styles.legendValue}>{category.value}%</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={[styles.contentCard, styles.transactionsCard]}>
            <View style={styles.transactionsHeader}>
              <Text style={styles.sectionTitle}>Recent Transactions</Text>
              <TouchableOpacity>
                <Text style={styles.viewAll}>View all</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={transactionsList}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.transactionRow}>
                  <View style={styles.transactionIconWrapper}>
                    <Feather name={item.icon} size={18} color="#1f6f4d" />
                  </View>
                  <Text style={styles.transactionLabel}>{item.label}</Text>
                  <Text
                    style={[
                      styles.transactionAmount,
                      item.amount >= 0 && styles.amountPositive,
                      item.amount < 0 && styles.amountNegative,
                    ]}
                  >
                    {formatCurrency(item.amount)}
                  </Text>
                </View>
              )}
              ItemSeparatorComponent={() => <View style={styles.transactionDivider} />}
              scrollEnabled={false}
            />
          </View>

          <View style={[styles.contentCard, styles.ocrCard]}>
            <View style={styles.ocrHeader}>
              <Text style={styles.sectionTitle}>Latest OCR Items</Text>
              <Text style={styles.ocrHint}>Tap the camera button to scan a receipt</Text>
            </View>
            <FlatList
              data={ocrItems}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.ocrRow}>
                  <View style={styles.ocrBullet} />
                  <Text style={styles.ocrDescription}>{item.description}</Text>
                  <Text style={styles.ocrPrice}>{formatCurrency(item.price)}</Text>
                </View>
              )}
              ItemSeparatorComponent={() => <View style={styles.ocrDivider} />}
              ListEmptyComponent={() => (
                <Text style={styles.ocrEmptyState}>No OCR items yet.</Text>
              )}
              scrollEnabled={false}
            />
          </View>
        </View>
      </Pressable>
    </ScrollView>

    {isFabMenuOpen && (
      <Pressable style={styles.fabMenuBackdrop} onPress={() => setFabMenuOpen(false)}>
        <View style={styles.fabMenu}>
          <TouchableOpacity
            style={styles.fabMenuButton}
            onPress={() => {
              setFabMenuOpen(false);
              setManualModalVisible(true);
            }}
          >
            <View style={styles.fabMenuIconWrapper}>
              <Feather name="edit-3" size={20} color="#1f6f4d" />
            </View>
            <Text style={styles.fabMenuLabel}>Manual</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.fabMenuButton}
            onPress={async () => {
              try {
                setFabMenuOpen(false);
                setOcrError(null);
                setOcrLoading(true);
                setOcrModalVisible(true);
                const result = VisionKitOcr
                  ? await VisionKitOcr.scanReceipt()
                  : await Promise.reject(
                      new Error('VisionKitOcr native module unavailable. Ensure iOS build is configured.'),
                    );
                if (Array.isArray(result?.items)) {
                  setPendingItems(
                    result.items.map((item, index) => ({
                      id: item.id || `ocr-${Date.now()}-${index}`,
                      description: item.description || 'Item',
                      price: Number(item.price) || 0,
                    })),
                  );
                } else {
                  setPendingItems([]);
                  setOcrError('No items detected. Try rescanning your receipt.');
                }
              } catch (error) {
                console.error('VisionKit OCR error', error);
                setPendingItems([]);
                setOcrError(error.message || 'Unable to parse receipt.');
              } finally {
                setOcrLoading(false);
              }
            }}
          >
            <View style={styles.fabMenuIconWrapper}>
              <Feather name="camera" size={20} color="#1f6f4d" />
            </View>
            <Text style={styles.fabMenuLabel}>OCR (Camera)</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    )}

    <TouchableOpacity
      style={[styles.fab, isFabMenuOpen && styles.fabActive]}
      onPress={() => setFabMenuOpen((prev) => !prev)}
      activeOpacity={0.85}
    >
      <Feather name={isFabMenuOpen ? 'x' : 'plus'} size={32} color="#e9f8f0" />
    </TouchableOpacity>

    <Modal
      visible={isOcrModalVisible}
      animationType="slide"
      transparent
      onRequestClose={() => setOcrModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalSheet}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Review Extracted Items</Text>
            <TouchableOpacity onPress={() => setOcrModalVisible(false)}>
              <Feather name="x" size={24} color="#1f3b2d" />
            </TouchableOpacity>
          </View>

          {isOcrLoading ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color="#1f6f4d" />
              <Text style={styles.modalLoadingText}>Scanning receipt…</Text>
            </View>
          ) : (
            <View style={styles.modalContent}>
              {ocrError ? <Text style={styles.modalError}>{ocrError}</Text> : null}
              <FlatList
                data={pendingItems}
                keyExtractor={(item) => item.id}
                renderItem={({ item, index }) => (
                  <View style={styles.modalRow}>
                    <TextInput
                      value={item.description}
                      onChangeText={(text) => {
                        const updated = [...pendingItems];
                        updated[index] = { ...updated[index], description: text };
                        setPendingItems(updated);
                      }}
                      style={styles.modalInputDescription}
                    />
                    <TextInput
                      value={String(item.price)}
                      onChangeText={(text) => {
                        const updated = [...pendingItems];
                        const numericValue = Number(text.replace(/[^0-9.]/g, '')) || 0;
                        updated[index] = { ...updated[index], price: numericValue };
                        setPendingItems(updated);
                      }}
                      keyboardType="decimal-pad"
                      style={styles.modalInputPrice}
                    />
                  </View>
                )}
                ItemSeparatorComponent={() => <View style={styles.modalDivider} />}
                ListEmptyComponent={() => (
                  <Text style={styles.modalEmptyState}>No items detected yet.</Text>
                )}
              />
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => {
                  setOcrItems((prev) => [
                    ...pendingItems.map((item) => ({
                      id: `${Date.now()}-${item.description}`,
                      description: item.description,
                      price: item.price,
                    })),
                    ...prev,
                  ]);
                  setPendingItems([]);
                  setOcrModalVisible(false);
                }}
              >
                <Text style={styles.primaryButtonText}>Confirm Items</Text>
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
    <Modal
      visible={isManualModalVisible}
      animationType="slide"
      transparent
      onRequestClose={() => setManualModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalSheet}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Transaction</Text>
            <TouchableOpacity onPress={() => setManualModalVisible(false)}>
              <Feather name="x" size={24} color="#1f3b2d" />
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <View style={styles.amountInputCard}>
              <View style={styles.amountRow}>
                <Text style={styles.amountCurrency}>{currencySymbol}</Text>
                <TextInput
                  value={manualAmount}
                  onChangeText={(text) => setManualAmount(text.replace(/[^0-9.,-]/g, ''))}
                  placeholder="0.00"
                  placeholderTextColor="#7a8b80"
                  keyboardType="decimal-pad"
                  style={styles.amountInputLarge}
                  selectionColor="#1f6f4d"
                />
              </View>
            </View>

            <TextInput
              value={manualPayee}
              onChangeText={setManualPayee}
              placeholder="Payee"
              placeholderTextColor="#7a8b80"
              style={styles.modalInputDescription}
              selectionColor="#1f6f4d"
            />

            <View style={styles.detailsCard}>
              <Text style={styles.detailsTitle}>Details</Text>

              <Pressable style={styles.detailRow} onPress={() => setCategoryPickerOpen((p) => !p)}>
                <Text style={styles.detailLabel}>Category</Text>
                <View style={styles.detailValueWrap}>
                  <Text style={styles.detailValueText}>
                    {manualCategoryId ? (categories.find((c) => c.id === manualCategoryId)?.label || 'Select Category…') : 'Select Category…'}
                  </Text>
                  <Feather name={isCategoryPickerOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#1f3b2d" />
                </View>
              </Pressable>
              {isCategoryPickerOpen && (
                <View style={styles.categoryPicker}>
                  {categories.map((cat) => (
                    <Pressable
                      key={cat.id}
                      style={[styles.categoryOption, manualCategoryId === cat.id && styles.categoryOptionSelected]}
                      onPress={() => {
                        setManualCategoryId(cat.id);
                        setCategoryPickerOpen(false);
                      }}
                    >
                      <View style={[styles.legendDot, { backgroundColor: cat.color }]} />
                      <Text style={styles.categoryOptionText}>{cat.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <View style={styles.detailRowStatic}>
                <Text style={styles.detailLabel}>Description</Text>
                <TextInput
                  value={manualDescription}
                  onChangeText={setManualDescription}
                  placeholder="Description"
                  placeholderTextColor="#7a8b80"
                  style={styles.detailTextInput}
                  selectionColor="#1f6f4d"
                />
              </View>

              <Pressable style={styles.detailRow} onPress={() => setManualDate(new Date())}>
                <Text style={styles.detailLabel}>Date</Text>
                <View style={styles.detailValueWrap}>
                  <Feather name="calendar" size={16} color="#1f3b2d" />
                  <Text style={styles.detailValueText}>  {formatShortDate(manualDate)}</Text>
                </View>
              </Pressable>

              <View style={styles.detailRowDisabled}>
                <Text style={styles.detailLabel}>Account</Text>
                <Text style={styles.detailDisabledText}>Default</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={async () => {
                const amountNumber = Number(manualAmount);
                if (!isFinite(amountNumber)) {
                  Alert.alert('Invalid input', 'Please enter a valid amount.');
                  return;
                }
                const normalized = -Math.abs(amountNumber);
                const fallbackInsert = () => {
                  const newItem = {
                    id: `${Date.now()}`,
                    icon: 'shopping-bag',
                    label: (manualPayee || manualDescription).trim() || 'Transaction',
                    amount: normalized,
                  };
                  setTransactionsList((prev) => [newItem, ...prev]);
                };
                if (isSupabaseConfigured && supabase) {
                  try {
                    const { data, error } = await supabase
                      .from('transactions')
                      .insert({
                        label: (manualPayee || manualDescription).trim() || 'Transaction',
                        amount: normalized,
                        icon: 'shopping-bag',
                        category_id: manualCategoryId || null,
                        transaction_at: manualDate?.toISOString?.() || null,
                      })
                      .select('id,label,amount,icon')
                      .single();
                    if (error) throw error;
                    setTransactionsList((prev) => [
                      {
                        id: String(data.id),
                        icon: data.icon || 'shopping-bag',
                        label: data.label,
                        amount: Number(data.amount),
                      },
                      ...prev,
                    ]);
                  } catch (e) {
                    console.error('Insert transaction error', e);
                    Alert.alert('Save failed', e.message || 'Unable to save to Supabase. Saving locally instead.');
                    fallbackInsert();
                  }
                } else {
                  fallbackInsert();
                }
                setManualDescription('');
                setManualAmount('');
                setManualPayee('');
                setManualCategoryId(null);
                setManualDate(new Date());
                setManualModalVisible(false);
              }}
            >
              <Text style={styles.primaryButtonText}>Add Expense</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  </SafeAreaView>
);
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#dff1e3',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#dff1e3',
  },
  scrollContent: {
    paddingBottom: 120,
  },
  screenWrapper: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: '#dff1e3',
  },
  headerCard: {
    borderRadius: 32,
    paddingHorizontal: 24,
    paddingVertical: 28,
    marginTop: 16,
    shadowColor: '#1f6f4d',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  menuButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#1f6f4d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerConnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    height: 40,
    borderRadius: 16,
    backgroundColor: 'rgba(247, 247, 248, 1)',
    shadowColor: '#1f6f4d',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  headerConnectLogo: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },
  headerConnectText: {
    color: '#1f3b2d',
    fontWeight: '700',
  },
  balanceLabel: {
    color: '#e7f6ec',
    fontSize: 16,
    marginBottom: 12,
  },
  balanceValue: {
    color: '#f8fbf7',
    fontSize: 36,
    fontWeight: '700',
    marginBottom: 16,
  },
  balanceChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#e1f3e8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  balanceChangeText: {
    color: '#1f6f4d',
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 22,
    marginBottom: 12,
    padding: 4,
    backgroundColor: '#eaf6ed',
    borderRadius: 20,
  },
  tabChip: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabChipActive: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#1f6f4d',
  },
  tabChipText: {
    color: '#477556',
    fontSize: 15,
    fontWeight: '600',
  },
  tabChipTextActive: {
    color: '#f4fbf5',
    fontSize: 15,
    fontWeight: '700',
  },
  contentCard: {
    backgroundColor: '#f4fbf5',
    borderRadius: 28,
    padding: 24,
    marginTop: 16,
    shadowColor: '#1f6f4d',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1f3b2d',
  },
  donutWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    gap: 24,
  },
  donutStack: {
    width: donutSize,
    height: donutSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenter: {
    position: 'absolute',
    width: donutSize * 0.55,
    height: donutSize * 0.55,
    borderRadius: (donutSize * 0.55) / 2,
    backgroundColor: '#f4fbf5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    elevation: 4,
  },
  donutCenterLabel: {
    color: '#5b7a63',
    fontSize: 13,
    fontWeight: '600',
  },
  donutCenterValue: {
    color: '#1f6f4d',
    fontWeight: '700',
    fontSize: 18,
  },
  legend: {
    flex: 1,
    gap: 12,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 12,
  },
  legendLabel: {
    flex: 1,
    color: '#1f3b2d',
    fontSize: 15,
  },
  legendValue: {
    color: '#1f6f4d',
    fontWeight: '600',
  },
  transactionsCard: {
    marginBottom: 80,
  },
  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAll: {
    color: '#1f6f4d',
    fontWeight: '600',
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  transactionIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dcefe4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionLabel: {
    flex: 1,
    color: '#1f3b2d',
    fontSize: 15,
  },
  transactionAmount: {
    fontWeight: '700',
    fontSize: 15,
  },
  amountPositive: {
    color: '#1f6f4d',
  },
  amountNegative: {
    color: '#c73c3c',
  },
  transactionDivider: {
    height: 1,
    backgroundColor: '#e3f3e8',
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1f6f4d',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1f6f4d',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  fabActive: {
    backgroundColor: '#134e36',
    transform: [{ scale: 0.96 }],
  },
  fabMenu: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    padding: 16,
    borderRadius: 24,
    backgroundColor: '#f4fbf5',
    flexDirection: 'row',
    gap: 16,
    shadowColor: '#0f3122',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  fabMenuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  fabMenuButton: {
    alignItems: 'center',
    minWidth: 110,
  },
  fabMenuIconWrapper: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#dff1e4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  fabMenuLabel: {
    color: '#1f6f4d',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.3)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#f7faf7',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f3b2d',
  },
  modalLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 16,
  },
  modalLoadingText: {
    color: '#1f6f4d',
    fontWeight: '600',
  },
  modalContent: {
    gap: 24,
  },
  amountInputCard: {
    backgroundColor: '#eaf6ed',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  amountCurrency: {
    color: '#1f3b2d',
    fontSize: 22,
    fontWeight: '700',
  },
  amountInputLarge: {
    flex: 1,
    marginLeft: 8,
    color: '#1f3b2d',
    backgroundColor: 'transparent',
    fontWeight: '700',
    fontSize: 28,
    textAlign: 'right',
  },
  modalError: {
    backgroundColor: 'rgba(220, 53, 69, 0.08)',
    borderRadius: 14,
    padding: 12,
    color: '#b91c1c',
    fontWeight: '600',
  },
  modalRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  modalInputDescription: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f3b2d',
    shadowColor: '#1f6f4d',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  modalInputPrice: {
    width: 100,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f3b2d',
    textAlign: 'right',
    shadowColor: '#1f6f4d',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  modalDivider: {
    height: 1,
    backgroundColor: 'rgba(125, 160, 136, 0.2)',
    marginVertical: 12,
  },
  modalEmptyState: {
    textAlign: 'center',
    color: '#5b7a63',
    paddingVertical: 24,
  },
  detailsCard: {
    backgroundColor: '#f4fbf5',
    borderRadius: 18,
    padding: 12,
    gap: 10,
  },
  detailsTitle: {
    color: '#1f3b2d',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  detailRow: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailRowStatic: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  detailLabel: {
    color: '#1f3b2d',
    fontWeight: '600',
  },
  detailValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailValueText: {
    color: '#1f3b2d',
    fontWeight: '600',
  },
  detailTextInput: {
    marginTop: 4,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 8,
    color: '#1f3b2d',
  },
  categoryPicker: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e3f3e8',
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  categoryOptionSelected: {
    backgroundColor: '#eaf6ed',
  },
  categoryOptionText: {
    color: '#1f3b2d',
  },
  detailRowDisabled: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    opacity: 0.7,
  },
  detailDisabledText: {
    color: '#5b7a63',
  },
  primaryButton: {
    backgroundColor: '#1f6f4d',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#1f6f4d',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  primaryButtonText: {
    color: '#f7fffb',
    fontSize: 17,
    fontWeight: '700',
  },
  ocrCard: {
    marginBottom: 80,
  },
  ocrHeader: {
    marginBottom: 16,
  },
  ocrHint: {
    color: '#5b7a63',
    marginTop: 6,
  },
  ocrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  ocrBullet: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1f6f4d',
  },
  ocrDescription: {
    flex: 1,
    fontSize: 15,
    color: '#1f3b2d',
  },
  ocrPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f6f4d',
  },
  ocrDivider: {
    height: 1,
    backgroundColor: 'rgba(125, 160, 136, 0.2)',
  },
  ocrEmptyState: {
    textAlign: 'center',
    color: '#5b7a63',
    paddingVertical: 16,
  },
});
