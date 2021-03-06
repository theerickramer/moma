<template>
  <div v-if="src">
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
  <div v-else>
    <div class="loading"></div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      artist: null,
      date: null,
      medium: null,
      src: null,
      title: null,
      url: null  
    };
  },
  mounted: function() {
    const HOST = location.origin.replace(/^http/, 'ws')
    const ws = new WebSocket(`${HOST}/socket`);
    ws.onmessage = message => {
      const { ...data } = JSON.parse(message.data);
      Object.assign(this, data)
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

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.loading {
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.loading:before {
  display: block;
  margin: 0 auto;
  height: 40px;
  width: 40px;
  border: 2px solid #000000;
  border-top: 2px solid #ffffff;
  border-radius: 50%;
  content: "";
  animation: spin .5s infinite ease-in-out;
}

</style>
