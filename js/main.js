const form = document.getElementById('research-form');
const statusMessage = document.getElementById('status-message');
const insightPanel = document.getElementById('insight-panel');
const insightGrid = document.getElementById('insight-grid');
const resultPanel = document.getElementById('result-panel');
const resultList = document.getElementById('result-list');
const resultMeta = document.getElementById('result-meta');
const articlePanel = document.getElementById('article-panel');
const articlePreview = document.getElementById('article-preview');
const articleMeta = document.getElementById('article-meta');
const copyButton = document.getElementById('copy-markdown');
const downloadButton = document.getElementById('download-markdown');
const articleImage = document.getElementById('article-image');
const imageCaption = document.getElementById('image-caption');
const tryDemoButton = document.getElementById('try-demo');

const state = {
    currentStructure: null,
    markdown: '',
    imageUrl: '',
    serpSource: ''
};

const toneProfiles = {
    neutral: {
        label: 'ニュートラル',
        intro: keyword => `この記事では「${keyword}」について、検索ユーザーが求めている情報を整理しながら解説します。`,
        outro: '参考になれば幸いです。',
        voice: '丁寧でバランスの良い解説'
    },
    friendly: {
        label: 'フレンドリー',
        intro: keyword => `こんにちは！今回は「${keyword}」の疑問を、やさしい言葉でスッキリ整理していきます。`,
        outro: '今日からすぐ試してみてくださいね。',
        voice: '親しみやすい会話調'
    },
    expert: {
        label: 'プロフェッショナル',
        intro: keyword => `業界視点で「${keyword}」の重要ポイントと実践ノウハウを体系的に解説します。`,
        outro: '戦略立案や提案資料づくりにお役立てください。',
        voice: '専門的で根拠を意識した説明'
    }
};

const lengthProfiles = {
    short: { label: 'ショート', targetChars: 600, sections: 2 },
    standard: { label: '標準', targetChars: 1100, sections: 3 },
    long: { label: 'ロング', targetChars: 1500, sections: 4 }
};

const intentKeywords = {
    informational: ['とは', 'what', 'how', '使い方', '解説', '意味', 'ガイド', '基礎', '初心者', '事例', '仕組み'],
    commercial: ['比較', 'ランキング', 'おすすめ', 'レビュー', '評判', '選び方', 'メリット', 'デメリット', '導入', '事例'],
    transactional: ['価格', '費用', '料金', '購入', '申し込み', '予約', '導入', '資料請求', '問い合わせ', '見積'],
    navigational: ['公式', 'ログイン', 'アクセス', '店舗', '位置', '地図', '会社', 'サポート']
};

const stopWords = new Set([
    'the', 'and', 'for', 'with', 'that', 'this', 'from', 'about', 'into', 'have', 'your', 'will',
    'する', 'こと', 'よう', 'ため', 'です', 'ます', 'から', 'まで', 'では', 'あり', 'ある', 'また', 'など', 'これ', 'それ', 'その', 'この', 'ような', 'できる', 'なる', 'の', 'に', 'が', 'を', 'と', 'へ', 'や', 'も', 'で'
]);

form.addEventListener('submit', handleFormSubmit);
copyButton.addEventListener('click', handleCopyMarkdown);
downloadButton.addEventListener('click', handleDownloadMarkdown);
tryDemoButton.addEventListener('click', handleTryDemo);

function updateStatus(message, status) {
    statusMessage.textContent = message;
    if (status) {
        statusMessage.dataset.status = status;
    } else {
        delete statusMessage.dataset.status;
    }
}

async function handleFormSubmit(event) {
    event.preventDefault();
    const formData = new FormData(form);
    const keyword = (formData.get('keyword') || '').trim();
    const tone = formData.get('tone') || 'neutral';
    const length = formData.get('length') || 'standard';
    const persona = (formData.get('persona') || '').trim();
    const imageKeyword = (formData.get('image-keyword') || '').trim();

    if (!keyword) {
        updateStatus('検索キーワードを入力してください。', 'error');
        return;
    }

    form.classList.add('is-loading');
    form.querySelectorAll('button, input, select').forEach(el => {
        el.dataset.prevDisabled = el.disabled ? 'true' : 'false';
        el.disabled = true;
    });
    updateStatus('SERPをリサーチしています…', 'progress');

    try {
        const serpData = await fetchSerp(keyword);
        const insights = analyzeSearchIntent(keyword, serpData.results);
        const structure = buildArticleStructure({
            keyword,
            tone,
            length,
            persona,
            insights,
            results: serpData.results
        });
        const imageInfo = buildImage(keyword, imageKeyword);

        renderInsights(insights);
        renderSerpResults(serpData);
        renderArticle(structure, tone, imageInfo, insights.intentLabel);

        state.currentStructure = structure;
        state.markdown = buildMarkdown(structure, imageInfo);
        state.imageUrl = imageInfo.url;
        state.serpSource = serpData.source || '';

        copyButton.disabled = false;
        downloadButton.disabled = false;
        updateStatus(serpData.usedFallback
            ? 'APIアクセスに制限があったため、モックデータで記事案を生成しました。必要に応じて編集してください。'
            : '検索分析と記事生成が完了しました。', 'success');
    } catch (error) {
        console.error(error);
        updateStatus('データ取得中にエラーが発生しました。ネットワークとCORS設定をご確認ください。', 'error');
    } finally {
        form.classList.remove('is-loading');
        form.querySelectorAll('button, input, select').forEach(el => {
            el.disabled = el.dataset.prevDisabled === 'true';
            delete el.dataset.prevDisabled;
        });
    }
}

function handleTryDemo() {
    const examples = [
        {
            keyword: 'サブスク ビジネス モデル',
            tone: 'expert',
            length: 'long',
            persona: '新規事業担当者',
            image: 'subscription, business strategy'
        },
        {
            keyword: 'SNS キャンペーン 事例',
            tone: 'friendly',
            length: 'standard',
            persona: '中小企業のマーケ担当',
            image: 'social media marketing'
        },
        {
            keyword: 'ナレッジマネジメント ツール',
            tone: 'neutral',
            length: 'standard',
            persona: '情報システム部門',
            image: 'knowledge management, team collaboration'
        }
    ];
    const pick = examples[Math.floor(Math.random() * examples.length)];
    form.elements['keyword'].value = pick.keyword;
    form.elements['tone'].value = pick.tone;
    form.elements['length'].value = pick.length;
    form.elements['persona'].value = pick.persona;
    form.elements['image-keyword'].value = pick.image;
    form.dispatchEvent(new Event('submit'));
}

async function fetchSerp(keyword) {
    const encoded = encodeURIComponent(keyword);
    const candidates = [
        `https://r.jina.ai/https://www.google.com/search?q=${encoded}&hl=ja`,
        `https://r.jina.ai/https://www.bing.com/search?q=${encoded}&setlang=ja-jp`,
        `https://r.jina.ai/https://duckduckgo.com/?q=${encoded}&ia=web`
    ];

    for (const url of candidates) {
        try {
            const response = await fetch(url, {
                headers: {
                    'Accept': 'text/html,application/json;q=0.9,text/plain;q=0.8'
                }
            });
            if (!response.ok) continue;
            const contentType = response.headers.get('content-type') || '';
            const raw = await response.text();
            const results = contentType.includes('application/json')
                ? parseSerpJson(raw)
                : parseSerpText(raw);
            if (results.length) {
                return { results, raw, source: url, usedFallback: false };
            }
        } catch (error) {
            console.warn('SERP fetch failed', url, error);
        }
    }

    return {
        results: buildFallbackResults(keyword),
        raw: '',
        source: 'fallback',
        usedFallback: true
    };
}

function parseSerpJson(raw) {
    try {
        const json = JSON.parse(raw);
        if (Array.isArray(json.results)) {
            return json.results.map(item => ({
                title: item.title || item.heading || 'No title',
                snippet: item.body || item.snippet || item.description || '',
                url: item.url || item.link || '#'
            })).filter(item => item.url && item.title);
        }
        if (Array.isArray(json.organic_results)) {
            return json.organic_results.map(item => ({
                title: item.title || 'No title',
                snippet: item.snippet || item.summary || '',
                url: item.link || item.url || '#'
            })).filter(item => item.url && item.title);
        }
    } catch (error) {
        console.warn('JSON parse error', error);
    }
    return [];
}

function parseSerpText(raw) {
    const sanitized = raw
        .replace(/\r/g, '')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);

    const results = [];
    for (let i = 0; i < sanitized.length; i++) {
        const line = sanitized[i];
        if (/^https?:\/\//i.test(line) || line.startsWith('www.')) {
            const url = line.startsWith('http') ? line : `https://${line}`;
            const titleCandidate = sanitized[i - 1] && !/^https?:\/\//.test(sanitized[i - 1]) ? sanitized[i - 1] : '';
            const snippetCandidate = sanitized[i + 1] && !/^https?:\/\//.test(sanitized[i + 1]) ? sanitized[i + 1] : '';
            const title = titleCandidate || snippetCandidate || '検索結果';
            const snippet = snippetCandidate || '';
            results.push({ title, snippet, url });
        }
        if (results.length >= 12) break;
    }

    return dedupeResults(results);
}

function dedupeResults(results) {
    const seen = new Set();
    return results.filter(result => {
        try {
            const hostname = new URL(result.url).hostname;
            if (seen.has(hostname)) return false;
            seen.add(hostname);
            return true;
        } catch (error) {
            return true;
        }
    });
}

function buildFallbackResults(keyword) {
    const base = keyword.replace(/\s+/g, ' ');
    const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const core = base.replace(/とは|とは？|とは\?|とは。/g, '').trim();
    return [
        {
            title: `${base}とは？基礎知識と背景を押さえる`,
            snippet: `${base}の概要と最新トレンドをわかりやすく整理。検索ニーズを素早く把握したい方向けの要約です。`,
            url: `https://example.com/${slug || 'insight'}/overview`
        },
        {
            title: `${core || base}の最新動向と成功事例`,
            snippet: `国内外で注目される${base}の導入事例や成果を解説し、差別化ポイントを抽出します。`,
            url: `https://example.com/${slug || 'insight'}/case-study`
        },
        {
            title: `${base}を比較検討する際のチェックリスト`,
            snippet: `価格・機能・サポート体制など、検討フェーズで押さえたい評価軸を一覧化しました。`,
            url: `https://example.com/${slug || 'insight'}/comparison`
        },
        {
            title: `${base}で成果を出すための実践ステップ`,
            snippet: `実務で使えるロードマップとKPI設計のヒントをまとめ、次のアクションにつなげます。`,
            url: `https://example.com/${slug || 'insight'}/roadmap`
        },
        {
            title: `${base}のよくある質問と注意点`,
            snippet: `導入・運用でつまずきやすいポイントをQ&A形式で解説し、リスク回避をサポートします。`,
            url: `https://example.com/${slug || 'insight'}/faq`
        }
    ];
}

function analyzeSearchIntent(keyword, results) {
    const joined = results.map(item => `${item.title} ${item.snippet}`).join(' ').toLowerCase();
    const scores = {
        informational: 0,
        commercial: 0,
        transactional: 0,
        navigational: 0
    };
    const signals = [];

    Object.entries(intentKeywords).forEach(([intent, words]) => {
        words.forEach(word => {
            if (joined.includes(word.toLowerCase())) {
                scores[intent] += 1;
            }
        });
    });

    if (/公式|official|site|公式サイト|公式ページ/.test(joined)) {
        scores.navigational += 2;
        signals.push('公式サイトへのアクセスを求める検索が含まれています。');
    }
    if (/(価格|料金|費用|購入|予約|見積|申し込み)/.test(joined)) {
        scores.transactional += 2;
        signals.push('料金や購入に関するニーズが強く現れています。');
    }
    if (/(比較|ランキング|おすすめ|vs|評価)/.test(joined)) {
        scores.commercial += 2;
        signals.push('比較検討系のキーワードが多数ヒットしています。');
    }
    if (/(とは|what|how|使い方|基礎|初心者|意味)/.test(joined) || /\?$/.test(keyword)) {
        scores.informational += 2;
        signals.push('概要解説やHow-toを求める傾向が読み取れます。');
    }

    const entries = Object.entries(scores);
    entries.sort((a, b) => b[1] - a[1]);
    const [topIntent, topScore] = entries[0];
    const intentLabelMap = {
        informational: '情報収集（Informational）',
        commercial: '比較・検討（Commercial）',
        transactional: '取引・コンバージョン（Transactional）',
        navigational: 'サイト誘導（Navigational）'
    };

    const intentLabel = intentLabelMap[topIntent] || intentLabelMap.informational;

    const summary = buildIntentSummary(topIntent, keyword, topScore, signals);
    const audienceNeeds = buildAudienceNeeds(topIntent);
    const recommendedSections = buildRecommendedSections(topIntent, keyword);
    const topKeywords = extractKeywords(joined, keyword);

    return {
        intentLabel,
        topIntent,
        summary,
        signals: signals.length ? signals : ['検索結果から読み取れるキーワードパターンをもとに推定しました。'],
        audienceNeeds,
        recommendedSections,
        topKeywords
    };
}

function buildIntentSummary(intent, keyword, score, signals) {
    switch (intent) {
        case 'commercial':
            return `「${keyword}」の検索では比較・検討フェーズのコンテンツが目立ちます。ユーザーは他社事例や選定基準を求めており、差別化ポイントの提示が重要です。`;
        case 'transactional':
            return `検索結果には価格・申し込み導線が多く、ユーザーは具体的な導入や購入アクションを視野に入れています。CTAと信頼の裏付けを強調しましょう。`;
        case 'navigational':
            return `公式サイトやログインページへの誘導が多いため、認知済みユーザーが目的の情報へ素早くアクセスしたい意図が強いと考えられます。`;
        default:
            return `「${keyword}」は概要解説やHow-to系のニーズが高いキーワードです。基礎の理解から実践ポイントまでを体系立てて整理すると、検索意図を満たせます。`;
    }
}

function buildAudienceNeeds(intent) {
    switch (intent) {
        case 'commercial':
            return [
                '複数サービスの比較軸や評価指標が知りたい',
                '導入企業の実例・事例で信頼性を確認したい',
                '意思決定の後押しとなるチェックリストを求めている'
            ];
        case 'transactional':
            return [
                '価格帯や費用対効果を具体的に把握したい',
                '導入までの手順やサポート体制を確認したい',
                '申し込み前に不安点を解消できるQ&Aを求めている'
            ];
        case 'navigational':
            return [
                '公式リソースやログインページへ素早くアクセスしたい',
                '問い合わせ窓口・サポート情報を知りたい',
                '信頼できる一次情報を確認したい'
            ];
        default:
            return [
                '基本的な概要や用語の意味を理解したい',
                '成功事例や応用方法を知りたい',
                '具体的な手順やテンプレートを活用したい'
            ];
    }
}

function buildRecommendedSections(intent, keyword) {
    const base = [
        'キーワードの概要と背景整理',
        '検索意図から読み取れる課題・ニーズ',
        '解決アプローチと実践ステップ',
        '導入・実行時の注意点とFAQ'
    ];
    if (intent === 'commercial') {
        base.splice(2, 0, `${keyword}の比較ポイントと評価基準`);
    }
    if (intent === 'transactional') {
        base.splice(2, 0, `${keyword}導入の費用感とROIシミュレーション`);
    }
    if (intent === 'navigational') {
        base[1] = '公式リソースとナレッジベースのまとめ';
    }
    return base;
}

function extractKeywords(text, keyword) {
    const cleaned = text
        .replace(/[0-9]+/g, ' ')
        .replace(/["'`]/g, ' ')
        .replace(/[\u3000]/g, ' ');
    const tokens = cleaned.split(/[\s、。・\-\(\)「」『』【】［］\[\]\/\\:,;!?]+/u)
        .map(token => token.trim())
        .filter(Boolean);

    const baseKeywordPieces = keyword.split(/[\s、。・\-]+/).filter(Boolean).map(piece => piece.toLowerCase());
    const freq = new Map();

    tokens.forEach(token => {
        const lower = token.toLowerCase();
        if (stopWords.has(lower)) return;
        if (baseKeywordPieces.includes(lower)) return;
        if (lower.length <= 1) return;
        freq.set(token, (freq.get(token) || 0) + 1);
    });

    return Array.from(freq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word]) => word);
}

function buildArticleStructure({ keyword, tone, length, persona, insights, results }) {
    const toneProfile = toneProfiles[tone] || toneProfiles.neutral;
    const lengthProfile = lengthProfiles[length] || lengthProfiles.standard;
    const introText = toneProfile.intro(keyword);

    const topResults = results.slice(0, 5).map(item => item.title).filter(Boolean);
    const personaText = persona ? `（想定読者：${persona}）` : '';

    let keyTopics = insights.topKeywords.slice(0, Math.max(2, lengthProfile.sections));
    if (!keyTopics.length) {
        keyTopics = [
            `${keyword}の基本`,
            `${keyword}の活用`,
            `${keyword}の注意点`
        ].slice(0, Math.max(2, lengthProfile.sections));
    }
    const sections = [];

    sections.push({
        heading: `${keyword}の概要`,
        paragraphs: [
            `${introText} ${persona ? `主な読者は${persona}を想定し、実務で使える視点にフォーカスします。` : ''}`.trim(),
            topResults.length
                ? `検索上位には「${topResults.join('」「')}」といったページが並び、${insights.summary}`
                : `検索APIから取得できた情報が限られているため、一般的な検索意図分析とコンテンツ構成のベストプラクティスをベースにご提案します。`
        ]
    });

    sections.push({
        heading: '検索インテントから見えるニーズ',
        paragraphs: [
            `SERP分析では${insights.intentLabel}の傾向が強く、特に「${insights.signals.join(' / ')}」という兆候が確認できました。`,
            `コンテンツで満たすべき読者ニーズは以下の通りです。`
        ],
        bullets: insights.audienceNeeds
    });

    keyTopics.forEach((topic, index) => {
        const title = `${topic}を押さえるポイント`;
        const section = {
            heading: title,
            paragraphs: [
                `${topic}は検索結果でも頻出している注目テーマです。競合より深い洞察を提供するために、一次情報や具体例を交えて解説しましょう。`
            ]
        };
        if (lengthProfile.sections > 2) {
            section.paragraphs.push(
                `${toneProfile.voice}で「課題→解決策→成果」の順に語ると、読者の納得感が高まります。関連するデータポイントやベストプラクティスも添えましょう。`
            );
        }
        sections.push(section);
    });

    if (sections.length < lengthProfile.sections + 1) {
        sections.push({
            heading: '実践ステップとチェックリスト',
            paragraphs: [
                '導入準備、実装、運用改善までのステップを時系列で整理します。各ステップで必要なリソースや意思決定ポイントを明確化し、アクションにつなげましょう。'
            ],
            bullets: [
                '現状の課題とKPIを明確化する',
                '比較検討の評価軸を定義する',
                '導入後の運用体制と改善ループを設計する'
            ]
        });
    }

    const conclusion = `${toneProfile.outro} 検索意図を満たすだけでなく、自社ならではの視点や独自データを盛り込み、読者にとって唯一無二の価値を提供しましょう。`;
    const callToAction = insights.topIntent === 'transactional'
        ? '導入や申し込みを検討中の場合は、無料デモやカスタム見積の案内を明確に提示しましょう。'
        : insights.topIntent === 'commercial'
            ? '比較検討段階の読者には、詳細資料や導入事例のダウンロードリンクを配置すると転換率が向上します。'
            : '関連するホワイトペーパーやチェックリストを用意すると、リード獲得につながります。';

    const estimatedChars = sections.reduce((sum, section) => {
        const sectionText = [...section.paragraphs, ...(section.bullets || [])].join('');
        return sum + sectionText.replace(/\s+/g, '').length;
    }, conclusion.length);
    const readingTime = Math.max(1, Math.round(estimatedChars / 500));

    return {
        title: `${keyword}の検索意図を満たす記事構成ガイド${personaText}`,
        tone: toneProfile.label,
        intro: introText,
        sections,
        conclusion,
        callToAction,
        readingTime,
        targetLength: lengthProfile.targetChars,
        persona: persona || null
    };
}

function buildImage(keyword, imageKeyword) {
    const base = imageKeyword || keyword;
    const query = encodeURIComponent(base.replace(/\s+/g, ','));
    const url = `https://source.unsplash.com/960x540/?${query}`;
    return {
        url,
        caption: `Unsplashから自動取得した参考イメージ（キーワード：${base}）`
    };
}

function renderInsights(insights) {
    insightGrid.innerHTML = '';
    insightPanel.classList.remove('hidden');

    const intentCard = document.createElement('div');
    intentCard.className = 'insight-card';
    intentCard.innerHTML = `
        <h3>検索意図</h3>
        <p><strong>${insights.intentLabel}</strong></p>
        <p>${insights.summary}</p>
    `;

    const signalCard = document.createElement('div');
    signalCard.className = 'insight-card';
    signalCard.innerHTML = `
        <h3>観測されたシグナル</h3>
        <ul>${insights.signals.map(signal => `<li>${signal}</li>`).join('')}</ul>
    `;

    const keywordCard = document.createElement('div');
    keywordCard.className = 'insight-card';
    keywordCard.innerHTML = `
        <h3>頻出サブトピック</h3>
        <div>${insights.topKeywords.length
            ? insights.topKeywords.map(word => `<span class="keyword-chip">${word}</span>`).join('')
            : '<p>頻出キーワードが取得できませんでした。</p>'}
        </div>
    `;

    const audienceCard = document.createElement('div');
    audienceCard.className = 'insight-card';
    audienceCard.innerHTML = `
        <h3>想定読者のニーズ</h3>
        <ul>${insights.audienceNeeds.map(need => `<li>${need}</li>`).join('')}</ul>
    `;

    const sectionCard = document.createElement('div');
    sectionCard.className = 'insight-card';
    sectionCard.innerHTML = `
        <h3>推奨セクション案</h3>
        <ul>${insights.recommendedSections.map(section => `<li>${section}</li>`).join('')}</ul>
    `;

    insightGrid.append(intentCard, signalCard, keywordCard, audienceCard, sectionCard);
}

function renderSerpResults(serpData) {
    resultPanel.classList.remove('hidden');
    resultList.innerHTML = '';

    const formatter = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' });
    const timestamp = formatter.format(new Date());
    resultMeta.textContent = serpData.usedFallback
        ? `表示中の結果はテンプレートデータです（${timestamp}）。`
        : `取得元: ${serpData.source?.replace('https://r.jina.ai/https://', '') || 'N/A'}｜取得時刻: ${timestamp}`;

    if (!serpData.results.length) {
        const emptyState = document.createElement('li');
        emptyState.className = 'result-item';
        emptyState.innerHTML = '<p class="result-snippet">検索結果が取得できませんでした。キーワードやネットワーク設定を確認のうえ再試行してください。</p>';
        resultList.appendChild(emptyState);
        return;
    }

    serpData.results.forEach(result => {
        const item = document.createElement('li');
        item.className = 'result-item';

        const title = document.createElement('h3');
        title.className = 'result-title';
        const link = document.createElement('a');
        link.href = result.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = result.title;
        title.appendChild(link);

        const snippet = document.createElement('p');
        snippet.className = 'result-snippet';
        snippet.textContent = result.snippet || 'スニペット情報が取得できませんでした。';

        const meta = document.createElement('div');
        meta.className = 'result-meta';
        const domain = extractHostname(result.url);
        const domainType = classifyDomain(domain);
        meta.innerHTML = `
            <span class="result-pill">${domain}</span>
            <span class="result-pill">${domainType}</span>
        `;

        item.append(title, snippet, meta);
        resultList.appendChild(item);
    });
}

function renderArticle(structure, tone, imageInfo, intentLabel) {
    articlePanel.classList.remove('hidden');
    articlePreview.innerHTML = '';

    const header = document.createElement('div');
    header.innerHTML = `<h1>${structure.title}</h1>`;
    articlePreview.appendChild(header);

    structure.sections.forEach(section => {
        const sectionEl = document.createElement('section');
        const heading = document.createElement('h2');
        heading.textContent = section.heading;
        sectionEl.appendChild(heading);

        section.paragraphs.forEach(paragraph => {
            const p = document.createElement('p');
            p.textContent = paragraph;
            sectionEl.appendChild(p);
        });

        if (section.bullets && section.bullets.length) {
            const ul = document.createElement('ul');
            section.bullets.forEach(item => {
                const li = document.createElement('li');
                li.textContent = item;
                ul.appendChild(li);
            });
            sectionEl.appendChild(ul);
        }

        articlePreview.appendChild(sectionEl);
    });

    const conclusionEl = document.createElement('section');
    const conclusionHeading = document.createElement('h2');
    conclusionHeading.textContent = 'まとめと次のアクション';
    conclusionEl.appendChild(conclusionHeading);

    const conclusionText = document.createElement('p');
    conclusionText.textContent = structure.conclusion;
    conclusionEl.appendChild(conclusionText);

    const cta = document.createElement('p');
    cta.textContent = structure.callToAction;
    conclusionEl.appendChild(cta);

    articlePreview.appendChild(conclusionEl);

    const personaInfo = structure.persona ? `想定読者：${structure.persona}｜` : '';
    articleMeta.textContent = `${personaInfo}推定読了時間：${structure.readingTime}分｜トーン：${toneProfiles[tone].label}｜インテント：${intentLabel}`;

    articleImage.src = imageInfo.url;
    articleImage.alt = imageInfo.caption;
    imageCaption.textContent = imageInfo.caption;
}

function buildMarkdown(structure, imageInfo) {
    const lines = [];
    lines.push(`# ${structure.title}`);
    lines.push('');
    if (imageInfo?.url) {
        lines.push(`![${imageInfo.caption}](${imageInfo.url})`);
        lines.push('');
    }
    structure.sections.forEach(section => {
        lines.push(`## ${section.heading}`);
        lines.push('');
        section.paragraphs.forEach(paragraph => {
            lines.push(paragraph);
            lines.push('');
        });
        if (section.bullets && section.bullets.length) {
            section.bullets.forEach(item => {
                lines.push(`- ${item}`);
            });
            lines.push('');
        }
    });
    lines.push('## まとめと次のアクション');
    lines.push('');
    lines.push(structure.conclusion);
    lines.push('');
    lines.push(`> ${structure.callToAction}`);
    lines.push('');
    return lines.join('\n');
}

async function handleCopyMarkdown() {
    if (!state.markdown) return;
    try {
        await navigator.clipboard.writeText(state.markdown);
        updateStatus('Markdownをクリップボードにコピーしました。', 'success');
    } catch (error) {
        updateStatus('コピーに失敗しました。ブラウザの権限設定をご確認ください。', 'error');
    }
}

function handleDownloadMarkdown() {
    if (!state.markdown) return;
    const blob = new Blob([state.markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'serp-research-article.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    updateStatus('Markdownファイルをダウンロードしました。', 'success');
}

function extractHostname(url) {
    try {
        const { hostname } = new URL(url);
        return hostname.replace(/^www\./, '');
    } catch (error) {
        return url;
    }
}

function classifyDomain(hostname) {
    if (!hostname) return 'ドメイン不明';
    if (/\.go\.jp$|\.lg\.jp$|\.ac\.jp$/i.test(hostname)) return '公的機関/教育';
    if (/\.co\.jp$|\.com$|\.io$|\.ai$/i.test(hostname)) return '企業サイト';
    if (/blog|note|medium|hatena|qiita|zenn/i.test(hostname)) return 'ブログ/ナレッジ';
    if (/news|media|press|prtimes|businessinsider|forbes/i.test(hostname)) return 'メディア';
    if (/youtube|vimeo|spotify/i.test(hostname)) return '動画/音声';
    return 'その他サイト';
}

// Accessibility enhancement: remove loading state on page load
window.addEventListener('DOMContentLoaded', () => {
    updateStatus('キーワードを入力してリサーチを開始してください。');
});
