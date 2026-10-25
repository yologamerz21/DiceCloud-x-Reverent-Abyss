<template>
  <v-layout
    wrap
    align-center
    justify-center
    style="min-height: 42px;"
    :class="{ hover }"
    class="my-1 health-bar mortality-health-bar"
    :data-id="model._id"
  >
    <div
      class="subheading text-truncate pa-2 name"
      @mouseover="hover = true"
      @mouseleave="hover = false"
      @click="$emit('click')"
    >
      {{ model.name }}
    </div>
    <v-flex
      style="flex-basis: 300px; flex-grow: 100;"
    >
      <health-bar-progress
        :model="model"
        style="cursor: pointer;"
        @click="edit"
      >
        <!-- The part of the bar above Mortality can't be healed -->
        <div
          v-if="mortalityProp && lostFraction > 0"
          class="mortality-lost"
          :style="{ left: `${(1 - lostFraction) * 100}%` }"
        />
        <div
          class="value"
          :class="{
            'white--text': isTextLight,
            'black--text': !isTextLight,
          }"
        >
          {{ model.value }} / {{ mortalityProp ? mortality : model.total }}
        </div>
      </health-bar-progress>
      <div
        class="text-caption text-center mortality-caption"
        :class="{ 'error--text': !mortalityProp }"
      >
        <template v-if="mortalityProp">
          {{ mortalityTitle }} {{ mortality }} / {{ model.total }}
        </template>
        <template v-else>
          No Mortality attribute named "{{ mortalityVariableName }}"
        </template>
      </div>
      <v-menu
        v-model="editing"
        absolute
        transition="scale-transition"
        origin="center center"
        content-class="no-menu-shadow"
        :position-x="x"
        :position-y="y"
        :min-width="305"
        :close-on-content-click="false"
      >
        <increment-menu
          :value="model.value"
          :open="editing"
          @change="changeIncrementMenu"
          @close="cancelEdit"
        />
      </v-menu>
    </v-flex>
  </v-layout>
</template>

<script lang="js">
import IncrementMenu from '/imports/client/ui/components/IncrementMenu.vue';
import isDarkColor from '/imports/client/ui/utility/isDarkColor';
import HealthBarProgress from '/imports/client/ui/properties/components/attributes/HealthBarProgress.vue';
import CreatureProperties from '/imports/api/creature/creatureProperties/CreatureProperties';
import { getMortalityVariableName } from '/imports/constants/RA_HEALTH';
import chroma from 'chroma-js';

/**
 * Reverent Abyss: a health bar for the "Mortality" attribute type.
 * Shows current HP out of Mortality, and Mortality out of the True Maximum HP.
 */
export default {
  components: {
    IncrementMenu,
    HealthBarProgress,
  },
  inject: {
    theme: {
      default: {
        isDark: false,
      },
    },
  },
  props: {
    model: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      editing: false,
      hover: false,
      x: 0,
      y: 0,
    };
  },
  computed: {
    mortalityVariableName() {
      return getMortalityVariableName(this.model);
    },
    mortality() {
      return this.mortalityProp?.value ?? this.model.total;
    },
    mortalityTitle() {
      return this.mortalityProp?.name || 'Mortality';
    },
    // Fraction of the True Maximum that Mortality no longer covers
    lostFraction() {
      const total = this.model.total;
      if (!(total > 0)) return 0;
      const fraction = 1 - this.mortality / total;
      return Math.min(Math.max(fraction, 0), 1);
    },
    color() {
      return this.model.color || this.$vuetify.theme.currentTheme.primary
    },
    barBackgroundColor() {
      return chroma(this.color)
        .darken(1.5)
        .desaturate(1.5)
        .hex();
    },
    isTextLight() {
      return isDarkColor(this.barBackgroundColor);
    },
  },
  meteor: {
    // The active attribute holding this creature's Mortality
    mortalityProp() {
      return CreatureProperties.findOne({
        'root.id': this.model.root?.id,
        type: 'attribute',
        variableName: this.mortalityVariableName,
        removed: { $ne: true },
        inactive: { $ne: true },
        overridden: { $ne: true },
      });
    },
  },
  methods: {
    edit(e) {
      e.preventDefault()
      this.editing = false;
      this.x = e.clientX - 165;
      this.y = e.clientY - 24;
      this.$nextTick(() => {
        this.editing = true
      });
    },
    cancelEdit() {
      this.editing = false;
    },
    changeIncrementMenu({ type, value }) {
      if (type === 'increment') value = -value;
      this.$emit('change', { type, value });
      this.editing = false;
    }
  },
};
</script>

<style scoped>
.mortality-health-bar {
  background: inherit;
}

.name {
  text-align: center;
  cursor: pointer;
  min-width: 150px;
  flex-basis: 150px;
  flex-grow: 1;
  flex-shrink: 1;
}

.name:hover {
  font-weight: 500;
}

.value {
  font-size: 15px;
  line-height: 24px;
  font-weight: 600;
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  text-align: center;
}

.mortality-lost {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  background: repeating-linear-gradient(
    -45deg,
    rgba(0, 0, 0, 0.45),
    rgba(0, 0, 0, 0.45) 4px,
    rgba(0, 0, 0, 0.15) 4px,
    rgba(0, 0, 0, 0.15) 8px
  );
  transition: left 0.5s ease;
}

.mortality-caption {
  opacity: 0.8;
  line-height: 1.4;
}
</style>
