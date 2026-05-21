'use strict';

/**
 * Search Module — Secure in-memory search index with fuzzy matching
 */

const Search = (() => {
    let searchIndex = null;

    // ─── Build Search Index ────────────────────────────────────────

    function buildIndex(entries) {
        searchIndex = entries.map(entry => {
            const searchable = [
                entry.title || '',
                entry.username || '',
                entry.url || '',
                entry.service || '',
                entry.bankName || '',
                entry.cardHolder || '',
                entry.fullName || '',
                entry.email || '',
                entry.host || '',
                entry.product || '',
                entry.notes || '',
                entry.content || '',
                ...(entry.tags || [])
            ].join(' ').toLowerCase();

            return {
                id: entry.id,
                entry: entry,
                searchable: searchable
            };
        });
    }

    // ─── Search ────────────────────────────────────────────────────

    function search(query) {
        if (!searchIndex || !query || query.trim().length === 0) {
            return null; // null means no filter
        }

        const terms = query.toLowerCase().trim().split(/\s+/);

        return searchIndex
            .filter(item => terms.every(term => item.searchable.includes(term)))
            .map(item => item.id);
    }

    // ─── Fuzzy Search ──────────────────────────────────────────────

    function fuzzySearch(query) {
        if (!searchIndex || !query || query.trim().length === 0) {
            return null;
        }

        const queryLower = query.toLowerCase().trim();

        return searchIndex
            .map(item => {
                const index = item.searchable.indexOf(queryLower);
                if (index !== -1) {
                    return { id: item.id, score: index === 0 ? 2 : 1 };
                }

                // Fuzzy: check if all characters exist in order
                let qi = 0;
                for (let si = 0; si < item.searchable.length && qi < queryLower.length; si++) {
                    if (item.searchable[si] === queryLower[qi]) {
                        qi++;
                    }
                }

                if (qi === queryLower.length) {
                    return { id: item.id, score: 0.5 };
                }

                return null;
            })
            .filter(Boolean)
            .sort((a, b) => b.score - a.score)
            .map(item => item.id);
    }

    // ─── Filter by Category ────────────────────────────────────────

    function filterByCategory(entries, category) {
        if (!category || category === 'all') return entries;
        if (category === 'favorites') return entries.filter(e => e.favorite);
        if (category === 'trash') return entries.filter(e => e.trashed);
        return entries.filter(e => e.category === category && !e.trashed);
    }

    // ─── Filter by Tags ────────────────────────────────────────────

    function filterByTags(entries, tags) {
        if (!tags || tags.length === 0) return entries;
        return entries.filter(entry =>
            tags.some(tag => (entry.tags || []).includes(tag))
        );
    }

    // ─── Sort Entries ──────────────────────────────────────────────

    function sortEntries(entries, sortBy = 'updatedAt', order = 'desc') {
        return [...entries].sort((a, b) => {
            // Favorites first
            if (a.favorite !== b.favorite) return b.favorite ? 1 : -1;

            let valA = a[sortBy] || '';
            let valB = b[sortBy] || '';

            if (sortBy === 'title') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }

            if (order === 'desc') {
                return valA > valB ? -1 : valA < valB ? 1 : 0;
            }
            return valA < valB ? -1 : valA > valB ? 1 : 0;
        });
    }

    // ─── Destroy Index ─────────────────────────────────────────────

    function destroy() {
        if (searchIndex) {
            // Overwrite entries in memory
            searchIndex.forEach(item => {
                item.entry = null;
                item.searchable = '';
            });
            searchIndex = null;
        }
    }

    // ─── Get All Tags ──────────────────────────────────────────────

    function getAllTags(entries) {
        const tagSet = new Set();
        entries.forEach(entry => {
            (entry.tags || []).forEach(tag => tagSet.add(tag));
        });
        return Array.from(tagSet).sort();
    }

    // ─── Public API ────────────────────────────────────────────────

    return {
        buildIndex,
        search,
        fuzzySearch,
        filterByCategory,
        filterByTags,
        sortEntries,
        destroy,
        getAllTags
    };
})();
