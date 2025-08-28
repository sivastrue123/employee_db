// src/utils/pagination.util.js
export function getPagination(query) {
  const pageSize = Math.min(
    Math.max(parseInt(query.pageSize ?? 20, 10), 1),
    100
  );
  const page = Math.max(parseInt(query.page ?? 1, 10), 1);
  const skip = (page - 1) * pageSize;
  return { page, pageSize, skip };
}


// src/utils/sort.util.js
const SORT_MAP = {
  client: 'name',
  owner: 'owner',
  progress: 'progress',
  duedate: 'dueDate',
};

export function getSort(query) {
  const sortKey = String(query.sortBy || '').toLowerCase();
  const field = SORT_MAP[sortKey] || 'dueDate'; // default sort
  const dirStr = String(query.sortDir || 'asc').toLowerCase();
  const dir = dirStr === 'desc' ? -1 : 1;
  return { [field]: dir };
}

// src/utils/search.util.js
export function buildClientSearchFilter({ q, tags }) {
  const filter = { deletedAt: null };

  // q matches: name OR owner OR tags
  if (q && String(q).trim()) {
    const text = String(q).trim();
    const regex = { $regex: text, $options: 'i' };
    filter.$or = [
      { name: regex },
      { owner: regex },
      { tags: regex }, // tags is array<string>, regex works on any element
    ];
  }

  // explicit tags filter (comma-separated or array)
  if (tags) {
    const tagList = Array.isArray(tags) ? tags : String(tags).split(',').map(s => s.trim()).filter(Boolean);
    if (tagList.length) {
      filter.tags = { $all: tagList }; // must include all provided tags
    }
  }

  return filter;
}
