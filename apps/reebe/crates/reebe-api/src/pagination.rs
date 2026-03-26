use serde::{Deserialize, Serialize};

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageRequest {
    pub page_size: Option<i64>,
    pub search_after: Option<Vec<serde_json::Value>>,
}

impl PageRequest {
    pub fn page_size_or_default(&self) -> i64 {
        self.page_size.unwrap_or(20).clamp(1, 1000)
    }

    pub fn after_key(&self) -> Option<i64> {
        self.search_after
            .as_ref()
            .and_then(|vals| vals.first())
            .and_then(|v| v.as_i64())
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PageResponse<T: Serialize> {
    pub items: Vec<T>,
    pub page: PageInfo,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PageInfo {
    pub total_items: i64,
    pub first_sort_values: Vec<serde_json::Value>,
    pub last_sort_values: Vec<serde_json::Value>,
}

impl<T: Serialize> PageResponse<T> {
    pub fn new(items: Vec<T>, first_key: Option<i64>, last_key: Option<i64>) -> Self {
        let count = items.len() as i64;
        Self {
            items,
            page: PageInfo {
                total_items: count,
                first_sort_values: first_key
                    .map(|k| vec![serde_json::Value::Number(k.into())])
                    .unwrap_or_default(),
                last_sort_values: last_key
                    .map(|k| vec![serde_json::Value::Number(k.into())])
                    .unwrap_or_default(),
            },
        }
    }

    pub fn empty() -> Self {
        Self::new(vec![], None, None)
    }
}
