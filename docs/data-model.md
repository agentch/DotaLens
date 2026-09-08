# DotaLens 数据模型

## 1. 设计原则

- 内部实体 ID 与来源 ID 分离，避免把页面标题当稳定主键。
- 保留必要的响应缓存和标准化数据，不建设复杂的数据分层。
- 多对多关系必须记录来源证据和同步时间。
- 金额同时保存原始字符串、数值和币种，不根据页面显示值盲目换算。
- 可变关系使用起止时间表达，不只保存“当前值”。

## 2. 核心实体

### `players`

- `id`
- `handle`：当前主要游戏 ID
- `real_name`
- `normalized_name`
- `nationality_code`
- `birth_date`
- `status`：active / inactive / retired / deceased / unknown
- `primary_role`
- `image_url`
- `total_winnings`：Liquipedia 信息框提供的个人总奖金原始值
- `liquipedia_page_name`
- `liquipedia_page_id`
- `source_url`
- `source_updated_at`
- `synced_at`

### `player_aliases`

- `player_id`
- `alias`
- `alias_type`：former_handle / localized / transliteration / other
- `source_id`

### `teams`

- `id`
- `name`
- `short_name`
- `region`
- `status`
- `liquipedia_page_id`
- `source_url`

### `player_team_tenures`

- `player_id`
- `team_id`
- `role`
- `position`
- `start_date`
- `end_date`
- `is_standin`
- `source_id`

### `tournaments`

- `id`
- `name`
- `series_name`
- `tier`
- `region`
- `start_date`
- `end_date`
- `prize_pool_amount`
- `prize_pool_currency`
- `liquipedia_page_id`
- `source_url`

### `tournament_participations`

- `id`
- `player_id`
- `tournament_id`
- `team_id`
- `placement_from`
- `placement_to`
- `placement_text`
- `result_text`
- `prize_amount`
- `prize_currency`
- `is_qualifier`
- `is_standin`
- `source_id`

这里的“参赛”应以存在赛事阵容、选手成绩或其他明确来源证据为准，不能仅凭选手当时属于某战队推断。

### `external_accounts`

- `player_id`
- `platform`
- `account_id`
- `profile_url`
- `is_verified_by_source`
- `source_id`

### `sources`

- `id`
- `provider`
- `source_type`
- `external_id`
- `url`
- `license`
- `retrieved_at`
- `content_hash`
- `raw_snapshot_key`

### `sync_runs`

记录任务范围、请求次数、成功/失败数量和错误信息，供本地页面展示。

## 3. 推荐索引与约束

- `players(liquipedia_page_id)` 唯一索引。
- `teams(liquipedia_page_id)`、`tournaments(liquipedia_page_id)` 唯一索引。
- `player_aliases(alias)` 普通索引；数据量不足以引入独立搜索服务。
- `tournament_participations(player_id, tournament_id, team_id)` 业务唯一约束；替补等多身份场景用额外 discriminator 处理。
- 所有关系表对 `source_id` 建索引。
- 日期允许为空或只有年份；不要用虚构的月日填充不完整日期。

## 4. 页面使用的内部接口

- `GET /api/players?q=&nationality=&team=&status=&page=`
- `GET /api/players/:id`
- `GET /api/players/:id/teams`
- `GET /api/players/:id/tournaments?year=&tier=`
- `POST /api/sync/players`：按名单或页面名执行同步
- `GET /api/sync/status`

这些接口只供本机页面调用，不作为公共 API 维护。详情响应包含 `sources` 和 `syncedAt`。
