<!-- A development build's checks of main-thread attributes: text that is no gesture, written as
plain text, and a plain function where a main-thread function goes. -->
<view class="gesture" main-thread:gesture="pan"></view>
<view class="plain" main-thread:ontap={() => 1}></view>
