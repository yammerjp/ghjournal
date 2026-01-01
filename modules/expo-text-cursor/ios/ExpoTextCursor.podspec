Pod::Spec.new do |s|
  s.name           = 'ExpoTextCursor'
  s.version        = '1.0.0'
  s.summary        = 'Get character index from tap coordinates'
  s.description    = 'A native module to calculate character index from tap coordinates using TextKit'
  s.author         = ''
  s.homepage       = 'https://github.com/yammerjp/ghjournal'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
  s.exclude_files = "**/*Tests.swift"
end
