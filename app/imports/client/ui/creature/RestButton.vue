<template lang="html">
  <v-btn
    :loading="loading"
    :disabled="context.editPermission === false"
    outlined
    :data-id="`rest-btn-${type}`"
    style="width: 160px;"
    @click="rest"
  >
    <v-icon left>
      {{ buttons[type].icon }}
    </v-icon>
    {{ buttons[type].text }}
  </v-btn>
</template>

<script lang="js">
import doAction from '/imports/client/ui/creature/actions/doAction';

// RA: the turn buttons reuse the rest button, firing turnStart and turnEnd
const buttons = {
  shortRest: { text: 'Short Rest', icon: 'mdi-music-rest-quarter' },
  longRest: { text: 'Long Rest', icon: 'mdi-bed' },
  turnStart: { text: 'Start Turn', icon: 'mdi-play-circle-outline' },
  turnEnd: { text: 'End Turn', icon: 'mdi-stop-circle-outline' },
};

export default {
  inject: {
    context: { default: {} }
  },
  props:{
    type: {
      type: String,
      required: true,
    },
    creatureId: {
      type: String,
      required: true,
    },
  },
  data(){return {
    loading: false,
    buttons,
  }},
  methods: {
    rest(){
      this.loading = true;
      doAction({
        creatureId: this.creatureId,
        $store: this.$store, 
        elementId: `rest-btn-${this.type}`, 
        task: {
          subtaskFn: 'reset',
          targetIds: [this.creatureId],
          eventName: this.type,
        },
      }).catch(e => {
        console.error(e);
      }).finally(() => {
        this.loading = false;
      });
    }
  }
}
</script>
