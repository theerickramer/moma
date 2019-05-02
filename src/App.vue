<template>
  <div>
    <div id="image">
      <img v-bind:src="src">
    </div>
    <a v-bind:href="url">
      <div class="info">
        <h2>{{ artist }}</h2>
        <h3>{{ title }}</h3>
        <p>{{ date }}</p>
        <p>{{ medium }}</p>
        <div id="refresh" @click="reload"></div>
      </div>
    </a>
  </div>
</template>

<script>
const data = window.data;

export default {
  data() {
    return data;
  },
  computed: {
    imgSrc: () => this.src
  },
  mounted: function() {
    const HOST = location.origin.replace(/^http/, 'ws')
    const ws = new WebSocket(`${HOST}/socket`);
    ws.onopen = () => {
      const message = {
        request: 'hiRes',
        jobId: this.jobId
      }
      ws.send(JSON.stringify(message));
    };

    ws.onmessage = response => {
      this.src = response.data
    };
  },
  methods: {
    reload: () => window.location.reload()
  }
};
</script>

<style>
body,
img,
#image {
  position: relative;
  margin: 0;
  width: 100%;
}

.info {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 100px 25px 25px 25px;
  background: linear-gradient(
    hsla(0, 0%, 0%, 0) 0%,
    hsla(0, 0%, 0%, 0.131) 19%,
    hsla(0, 0%, 0%, 0.23) 34%,
    hsla(0, 0%, 0%, 0.309) 47%,
    hsla(0, 0%, 0%, 0.361) 56.5%,
    hsla(0, 0%, 0%, 0.403) 65%,
    hsla(0, 0%, 0%, 0.437) 73%,
    hsla(0, 0%, 0%, 0.463) 80.2%,
    hsla(0, 0%, 0%, 0.479) 86.1%,
    hsla(0, 0%, 0%, 0.49) 91%,
    hsla(0, 0%, 0%, 0.496) 95.2%,
    hsla(0, 0%, 0%, 0.499) 98.2%,
    hsla(0, 0%, 0%, 0.5) 100%
  );
  color: #ffffff;
  font-family: "Franklin Gothic Medium", "Arial Narrow", Arial, sans-serif;
  z-index: 1;
  display: flex;
  flex-direction: column;
}

.info > * {
  margin: 0 0 10px 0;
  letter-spacing: 1px;
}

#refresh {
  align-self: flex-end;
  margin: 0;
  height: 25px;
  width: 25px;
  border: 2px solid #ffffff;
  border-radius: 15px;
  cursor: pointer;
}

#refresh:after {
  display: block;
  border-top: 2px solid #ffffff;
  margin: 7.5px;
  height: 7.5px;
  width: 7.5px;
  border-right: 2px solid #ffffff;
  transform: rotate(45deg);
  content: "";
}
</style>
