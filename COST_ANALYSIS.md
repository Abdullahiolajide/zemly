# Cost Analysis: Document Generation at Scale (10-30 pages)

## Current Setup
- **Model**: gemini-2.5-flash-lite (free tier)
- **Input Limit**: 6,000 characters (~1,500 tokens)
- **Pipeline**: Upload → Extract → Quiz/Flashcards + Chat

---

## Page-to-Token Conversion

| Document Size | Characters | Pages | Tokens (est.) |
|---|---|---|---|
| Current Max | 6,000 | 2-3 | 1,500 |
| 10 pages | 12,500-15,000 | 10 | 3,125-3,750 |
| 20 pages | 25,000-30,000 | 20 | 6,250-7,500 |
| 30 pages | 37,500-45,000 | 30 | 9,375-11,250 |

*Assumptions: Average page = 250 words, 1 word ≈ 5 chars, 4 chars ≈ 1 token*

---

## Genini Pricing (When Upgraded to Paid)

### Free Tier Limits
- ✅ **15 requests/min** (hard limit)
- ✅ **Unlimited calls** (within rate limit)
- ✅ **$0 cost** (but strict quotas)
- ❌ **Models limited**: Only 2-3 fast/lite models available
- ❌ **No large context**: Input/output capped at what fits quota

### Paid Tier (Pay-as-you-go)
- **Input tokens**: $0.075 per 1M tokens
- **Output tokens**: $0.30 per 1M tokens
- **Rate limits**: 10k requests/min (practically unlimited)

---

## Single Document Pipeline Cost (Paid Tier)

### Scenario A: 10-Page Document (3,500 tokens input)

#### Phase 1: Text Extraction
- **Input**: ~500 tokens (extraction prompt + document)
- **Output**: ~2,000 tokens (extracted text + metadata)
- **Cost**: (500 × $0.075 + 2,000 × $0.30) / 1M = **$0.0005**

#### Phase 2: Quiz Generation (single request, no chunks)
- **Input**: 3,500 tokens (document) + 500 tokens (system prompt)
- **Output**: ~2,000 tokens (30 questions, ~65 chars each)
- **Cost**: (4,000 × $0.075 + 2,000 × $0.30) / 1M = **$0.00090**
- **With retry** (if <15 questions): × 2 = **$0.00180**

#### Phase 3: Flashcard Generation (single request)
- **Input**: 3,500 tokens + 500 tokens (system prompt)
- **Output**: ~2,500 tokens (30 flashcards)
- **Cost**: (4,000 × $0.075 + 2,500 × $0.30) / 1M = **$0.00105**
- **With retry**: × 2 = **$0.00210**

#### Phase 4: Chat Questions (assume 3 follow-up questions, 200 tokens each)
- **Question 1**: In: 3,500 + 300 (msgs), Out: 400 → **$0.00014**
- **Question 2**: In: 3,500 + 300, Out: 400 → **$0.00014**
- **Question 3**: In: 3,500 + 300, Out: 400 → **$0.00014**
- **Total Chat Cost**: **$0.00042**

**Total 10-Page Cost**: ~**$0.0027-0.0035** (< 1¢)

---

### Scenario B: 20-Page Document (6,500 tokens input)

**Problem**: Exceeds current 6,000 char limit + requires chunking/summarization

#### Option 1: Single Request (REMOVE 6K LIMIT)
- **Extraction**: ~$0.0008
- **Quiz** (25-30 Qs): ~$0.0018
- **Flashcards** (25-30 FCs): ~$0.0015
- **Chat** (3 questions): ~$0.0008
- **Total**: ~**$0.005-0.006** (< 1¢)
- **Trade-off**: Uses ~50% of free tier's 15req/min quota, but fine for 1-2 users

#### Option 2: Chunked Processing (KEEP 6K LIMIT)
- Split 20 pages into 4 chunks of 5 pages each
- Process each chunk separately, merge results

**Per Chunk (5 pages ≈ 3,250 tokens):**
- Quiz: ~$0.00090 (15-20 Qs)
- Flashcards: ~$0.00080 (15-20 FCs)
- **Per chunk**: ~$0.0017

**4 Chunks Total**: ~$0.0068 × 4 = **$0.027** (< 1¢)
- **Advantage**: Distributes quota, covers all content
- **Disadvantage**: 4× API calls, more processing time

#### Option 3: Summarize First (SMART APPROACH)
- Extract 20 pages → summarize to 3-4 pages (1,500 tokens)
- Quiz from summary: ~$0.0008
- Flashcards from summary: ~$0.0008
- **Total**: ~$0.002 (< 1¢)
- **Advantage**: 10× cheaper, 4× fewer calls
- **Risk**: May lose less-important content

---

### Scenario C: 30-Page Document (9,500 tokens input)

**Current Approach FAILS**: Exceeds limit by 60%

#### Option 1: Remove 6K Cap (SIMPLEST)
- **Extraction**: ~$0.0010
- **Quiz** (30 Qs): ~$0.0025
- **Flashcards** (30 FCs): ~$0.0025
- **Chat** (3 questions): ~$0.0015
- **Total**: ~**$0.0075** (< 1¢)

#### Option 2: Multi-Chunk (4-5 chunks)
- 5-6 pages per chunk × 5 chunks
- **Per chunk**: ~$0.0017
- **Total**: ~$0.0085 (< 1¢)
- **API calls**: 15 requests for full processing

#### Option 3: Smart Summarization
- Extract & summarize 30 pages → ~2,000 tokens
- Quiz + Flashcards from summary
- **Total**: ~$0.003-0.004
- **Bonus**: User gets summary for topic overview

---

## Free Tier vs Paid Tier Comparison

| Use Case | Free Tier | Paid Tier | Recommendation |
|---|---|---|---|
| MVP (1-10 users, 2-3 pages max) | ✅ Works | 💰 $0.01-0.02/doc | Free tier sufficient |
| Growth (10-100 users, 10+ pages) | ⚠️ Rate limited | 💰 $0.005-0.03/doc | Upgrade + optimize |
| Scale (1000+ users, 20-30 pages) | ❌ Unusable | 💰 $0.01-0.05/doc | Chunking + summarization |

---

## Current Bottlenecks

### Free Tier Issues
1. **6,000 char limit**: Can't handle 10+ pages naturally
2. **15 req/min cap**: Only ~10 concurrent users before queuing
3. **Model selection**: Only 3-4 models available (all lite/flash)
4. **Quota resets**: Daily/RPD limits across all models

### Solutions

#### Short-term (Keep Free Tier)
```typescript
// Chunk documents > 6KB
const CHUNK_SIZE = 5000; // chars
const chunks = document.match(new RegExp(`.{1,${CHUNK_SIZE}}`, 'g')) || [];
const results = await Promise.all(chunks.map(chunk => generateQuiz(chunk)));
const merged = mergeQuestions(results);
```

#### Medium-term (Upgrade to Paid, No Chunking)
```typescript
// Remove MAX_NOTE_CHARS limit
const MAX_NOTE_CHARS = 500000; // 125k tokens (plenty for 30 pages)
// Cost: ~$0.01-0.02 per document
```

#### Best-practice (Paid + Summarization)
```typescript
// Extract full text
const fullText = await extractDocument(file);

// Summarize first
const summary = await summarizeText(fullText); // 1-2 pages worth

// Generate from summary
const quiz = await generateQuiz(summary);
const flashcards = await generateFlashcards(summary);

// Cost: ~$0.005 per document + engagement boost (summary included)
```

---

## Cost Per Use Case

### User Uploads 30-Page Textbook

#### Path 1: Direct Generation (Remove 6K Cap)
- Extract: $0.001
- Quiz (30Q): $0.0025
- Flashcards (30FC): $0.0025
- Chat (3Q): $0.0015
- **Per user**: $0.008 (⅞ of a cent)
- **100 users/month**: $0.80

#### Path 2: Chunked (Keep 6K Cap)
- 6 chunks × (extract + quiz + flashcards): $0.015-0.020
- Chat (on full doc summary): $0.001
- **Per user**: $0.020
- **100 users/month**: $2.00

#### Path 3: Smart Summarize (Paid + Recommended)
- Extract + summarize: $0.001
- Quiz + flashcards from summary: $0.005
- Chat on summary: $0.001
- **Per user**: $0.007
- **100 users/month**: $0.70
- **Bonus**: User gets summary in note

---

## Recommendation: Hybrid Approach

```typescript
// Modify gemini.ts
const MAX_NOTE_CHARS = 50000; // ~12,500 tokens (4 pages max at full, 30 pages if summarized)

export async function shouldSummarize(content: string): boolean {
    // If document > 20KB (5 pages), offer summarization
    if (content.length > 20000) {
        return true; // Suggest to user OR auto-summarize
    }
    return false;
}

// In generate-flashcards/quiz:
let noteContent = req.noteContent;
if (notes Content.length > MAX_NOTE_CHARS) {
    // Option A: Auto-summarize before generating
    const summary = await summarizeText(noteContent, 2000); // 500 tokens
    noteContent = summary;
    // Cost: +$0.0005 per request
    
    // Option B: Chunk and merge
    const chunks = chunkText(noteContent, MAX_NOTE_CHARS);
    const results = await Promise.all(chunks.map(c => generateQuiz(c)));
    return mergeResults(results);
}
```

---

## Action Items

- [ ] **Immediate**: Remove or increase `MAX_NOTE_CHARS` (6000 → 50000)
- [ ] **Cost tracking**: Log input/output tokens per request to monitor usage
- [ ] **Upgrade path**: When free tier hits limits, switch to paid (Google Cloud)
- [ ] **Optional**: Add summarization edge function for 20+ page docs
- [ ] **UI**: Show user estimated cost before generation ("This will cost ~1¢")
- [ ] **Chat function**: Implement AI bot conversations using same extraction as quiz/flashcards
