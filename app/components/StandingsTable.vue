<script setup lang="ts">
import type { GroupStanding } from '~/types'
import { getBadgeUrl } from '~/utils/images'
import { getTeamName } from '~/utils/teamNames'

defineProps<{
  rows: GroupStanding[]
  /** Название группы или конференции; у таблицы лиги не нужно */
  title?: string
}>()

function formatGoalDiff(goalDiff: number): string {
  return goalDiff > 0 ? `+${goalDiff}` : String(goalDiff)
}
</script>

<template>
  <section class="standings">
    <h2
      v-if="title"
      class="standings__title"
    >
      {{ title }}
    </h2>
    <div class="standings__card">
      <!-- На телефоне колонки с классом table__wide (В, Н, П, Мячи) скрыты -->
      <table class="table num">
        <thead>
          <tr>
            <th
              scope="col"
              class="table__pos"
            >
              #
            </th>
            <th
              scope="col"
              class="table__team"
            >
              Команда
            </th>
            <th scope="col">
              <abbr title="Игры">И</abbr>
            </th>
            <th
              scope="col"
              class="table__wide"
            >
              <abbr title="Победы">В</abbr>
            </th>
            <th
              scope="col"
              class="table__wide"
            >
              <abbr title="Ничьи">Н</abbr>
            </th>
            <th
              scope="col"
              class="table__wide"
            >
              <abbr title="Поражения">П</abbr>
            </th>
            <th
              scope="col"
              class="table__wide table__goals"
            >
              Мячи
            </th>
            <th
              scope="col"
              class="table__diff"
            >
              <abbr title="Разница мячей">РМ</abbr>
            </th>
            <th
              scope="col"
              class="table__points"
            >
              <abbr title="Очки">О</abbr>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, index) in rows"
            :key="row.team"
          >
            <td class="table__pos">
              <span
                class="table__pos-inner"
                :title="row.zone?.label"
              >
                <StandingZoneMark
                  :kind="row.zone?.kind ?? null"
                  variant="bar"
                />
                {{ index + 1 }}
              </span>
            </td>
            <td class="table__team">
              <span class="table__team-inner">
                <img
                  v-if="row.badge"
                  :src="getBadgeUrl(row.badge)"
                  alt=""
                  width="26"
                  height="26"
                  class="table__badge"
                >
                <span
                  v-else
                  class="table__badge table__badge--empty"
                />
                <span class="table__name">{{ getTeamName(row.team) }}</span>
              </span>
            </td>
            <td>{{ row.played }}</td>
            <td class="table__wide">
              {{ row.won }}
            </td>
            <td class="table__wide">
              {{ row.drawn }}
            </td>
            <td class="table__wide">
              {{ row.lost }}
            </td>
            <td class="table__wide table__goals">
              {{ row.goalsFor }}:{{ row.goalsAgainst }}
            </td>
            <td class="table__diff">
              {{ formatGoalDiff(row.goalDiff) }}
            </td>
            <td class="table__points">
              {{ row.points }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped lang="scss">
.standings {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.standings__title {
  margin: 4px 0 0;
  font-size: 12px;
  font-weight: 700;
  color: $color-text-2;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.standings__card {
  background: $color-surface;
  border: 1px solid $color-border;
  border-radius: $radius-card;
  overflow: hidden;
}

// Ширины колонок задаются по заголовкам (table-layout: fixed),
// команда занимает всё, что осталось. Отступы по краям карточки — у первой и последней ячеек.
.table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 15px;
}

th,
td {
  padding: 0 3px;
  text-align: center;
  white-space: nowrap;

  &:first-child {
    padding-left: 12px;
  }

  &:last-child {
    padding-right: 12px;
  }
}

th {
  height: 40px;
  font-size: 12px;
  font-weight: 600;
  color: $color-text-3;
  border-bottom: 1px solid $color-border;
  width: 30px;

  abbr {
    text-decoration: none;
  }
}

td {
  height: 46px;
  color: $color-text-2;
  border-bottom: 1px solid $color-border-soft;
}

tbody tr:last-child td {
  border-bottom: none;
}

.table__wide {
  display: none;
}

th.table__pos {
  width: 47px;
  text-align: left;
}

.table__pos-inner {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: $color-text;
}

th.table__team {
  width: auto;
  text-align: left;
}

.table__team-inner {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.table__badge {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  object-fit: contain;

  &--empty {
    border-radius: 50%;
    background: $color-badge-bg;
    border: 1px solid $color-border;
  }
}

.table__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
  color: $color-text;
}

th.table__diff {
  width: 42px;
}

td.table__diff {
  font-size: 13px;
}

th.table__points {
  width: 45px;
  text-align: right;
  color: $color-text;
}

td.table__points {
  text-align: right;
  font-weight: 700;
  color: $color-text;
}

@media (min-width: $breakpoint-desktop) {
  .standings__title {
    margin-top: 8px;
    font-size: 13px;
  }

  th,
  td {
    padding: 0;

    &:first-child {
      padding-left: 16px;
    }

    &:last-child {
      padding-right: 16px;
    }
  }

  th {
    height: 44px;
    font-size: 13px;
    width: 40px;
  }

  td {
    height: 48px;
  }

  .table__wide {
    display: table-cell;
  }

  th.table__pos {
    width: 56px;
  }

  .table__pos-inner {
    gap: 8px;
    font-size: 15px;
  }

  .table__team-inner {
    gap: 10px;
  }

  .table__badge {
    width: 26px;
    height: 26px;
  }

  th.table__goals {
    width: 64px;
  }

  th.table__diff {
    width: 48px;
  }

  td.table__diff {
    font-size: 15px;
  }

  th.table__points {
    width: 60px;
  }
}
</style>
