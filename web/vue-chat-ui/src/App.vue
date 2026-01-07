<script setup lang="ts">
import Header from './components/Header.vue'
import ErrorBanner from './components/ErrorBanner.vue'
import MessageList from './components/MessageList.vue'
import ChatInput from './components/ChatInput.vue'
</script>

<template>
  <div class="h-screen flex flex-col bg-dark-900 overflow-hidden">
    <Header />
    <ErrorBanner />
    <MessageList />
    <ChatInput />
  </div>
</template>
