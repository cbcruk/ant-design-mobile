// ===== Ant Design Mobile 통합 빌드 시스템 =====
// 목표: 다양한 환경(ES6, CommonJS, UMD, Bundle)과 해상도(1x, 2x)를 지원하는 포괄적 빌드 파이프라인
// 설계: 모던 웹 생태계의 모든 요구사항을 충족하는 최적화된 배포 시스템

// ===== 핵심 빌드 도구 Import =====
const gulp = require('gulp') // 태스크 러너 - 빌드 파이프라인의 중앙 조율자
const less = require('gulp-less') // LESS → CSS 컴파일러 - 스타일 시트 변환
const path = require('path') // 경로 유틸리티 - 크로스 플랫폼 경로 처리
const postcss = require('gulp-postcss') // CSS 후처리기 - autoprefixer 등 플러그인 적용
const babel = require('gulp-babel') // JavaScript 트랜스파일러 - ES6+ → 호환 코드 변환
const replace = require('gulp-replace') // 텍스트 치환 - 경로 수정 및 코드 변경
const ts = require('gulp-typescript') // TypeScript 컴파일러 - 타입 안전성과 최신 문법 지원
const del = require('del') // 파일/폴더 삭제 - 빌드 환경 정리
const webpackStream = require('webpack-stream') // Webpack-Gulp 브릿지 - 스트림 기반 번들링
const webpack = require('webpack') // 모듈 번들러 - 의존성 해결과 최적화
const through = require('through2') // 스트림 변환 - package.json 동적 수정용
const vite = require('vite') // 현대적 빌드 도구 - 빠른 번들링과 트리 셰이킹
const rename = require('gulp-rename') // 파일명 변경 - 배포용 파일명 조정
const autoprefixer = require('autoprefixer') // CSS 벤더 프리픽스 자동 추가 - 브라우저 호환성 확보

// ===== 분석 및 최적화 도구 =====
const BundleAnalyzerPlugin =
  require('webpack-bundle-analyzer').BundleAnalyzerPlugin // 번들 크기 시각화 - 최적화 포인트 식별
const tsconfig = require('./tsconfig.json') // TypeScript 설정 - 컴파일 옵션 공유
const packageJson = require('./package.json') // 패키지 메타데이터 - 버전 정보 등 활용
const StatoscopeWebpackPlugin = require('@statoscope/webpack-plugin').default // 상세 번들 분석 - 의존성 트리 시각화
const pxMultiplePlugin = require('postcss-px-multiple')({ times: 2 }) // 2x 해상도 지원 - px 값 자동 2배 변환

// ===== 빌드 환경 정리 =====
// 이전 빌드 산출물을 완전히 제거하여 깨끗한 빌드 환경 보장
// Why: 이전 빌드의 잔여 파일이 새 빌드와 충돌하는 것을 방지
// How: del 패키지로 lib 디렉토리 전체를 재귀적으로 삭제
function clean() {
  return del('./lib/**')
}

// ===== 스타일 시트 빌드 파이프라인 =====
// LESS 파일을 CSS로 컴파일하고 브라우저 호환성을 확보하는 핵심 스타일 처리 시스템
//
// 처리 과정:
// 1. LESS 파일 수집 (데모/테스트 파일 제외)
// 2. LESS → CSS 컴파일 (import 경로 해결)
// 3. PostCSS로 벤더 프리픽스 자동 추가
// 4. ES6/CommonJS 두 모듈 형태로 동시 출력
function buildStyle() {
  return gulp
    .src(['./src/**/*.less'], {
      base: './src/', // 소스 디렉토리 구조 유지
      ignore: ['**/demos/**/*', '**/tests/**/*', '*.patch.less'], // 불필요한 파일 제외
    })
    .pipe(
      less({
        paths: [path.join(__dirname, 'src')], // @import 경로 해결을 위한 기준 디렉토리
        relativeUrls: true, // CSS 내 상대 경로 URL 유지
      })
    )
    .pipe(
      postcss([
        autoprefixer({
          // 모바일 중심 브라우저 타겟 - iOS Safari와 Chrome 최소 버전 명시
          overrideBrowserslist: 'iOS >= 10, Chrome >= 49',
        }),
      ])
    )
    .pipe(gulp.dest('./lib/es')) // ES6 모듈 형태로 출력
    .pipe(gulp.dest('./lib/cjs')) // CommonJS 모듈 형태로 출력
}

// ===== CSS 패치 파일 복사 시스템 =====
// CSS 변수 폴백을 위한 패치 파일을 번들 디렉토리로 복사
// Why: CSS 변수를 지원하지 않는 레거시 브라우저를 위한 폴백 제공
// How: 고차 함수로 1x/2x 버전을 동적으로 처리하는 재사용 가능한 태스크 생성기
function copyPatchStyle(prefix = '') {
  return () =>
    gulp
      .src([`./lib${prefix}/es/global/css-vars-patch.css`]) // CSS 변수 패치 파일 선택
      .pipe(
        rename({
          dirname: '', // 디렉토리 구조 평면화
          extname: '.css', // 확장자 유지
        })
      )
      .pipe(gulp.dest(`./lib${prefix}/bundle`)) // 번들 디렉토리로 이동
}

// ===== 정적 자산 복사 시스템 =====
// 이미지, 폰트 등 정적 파일들을 모든 배포 형태에 복사
// Why: 컴포넌트에서 참조하는 정적 자원들이 런타임에 접근 가능해야 함
// How: 소스 assets를 여러 배포 디렉토리에 동시 복사하여 일관성 보장
function copyAssets() {
  return gulp
    .src('./src/assets/**/*') // 모든 정적 자산 수집
    .pipe(gulp.dest('lib/assets')) // 공통 assets 디렉토리
    .pipe(gulp.dest('lib/es/assets')) // ES6 모듈용
    .pipe(gulp.dest('lib/cjs/assets')) // CommonJS 모듈용
}

// ===== CommonJS 모듈 변환 시스템 =====
// ES6 모듈을 CommonJS 형태로 변환하여 Node.js와 레거시 환경 지원
//
// 설계 철학: 2단계 빌드 최적화
// 1단계: TypeScript → ES6 (최신 문법 활용)
// 2단계: ES6 → CommonJS (호환성 확보)
//
// Why: ES6 빌드 결과물을 재활용하여 빌드 시간 단축과 일관성 보장
// How: Babel 플러그인으로 import/export 구문만 선택적 변환
function buildCJS() {
  return gulp
    .src(['lib/es/**/*.js']) // ES6 빌드 결과물을 입력으로 사용 (효율적 재활용)
    .pipe(
      babel({
        // ES6 모듈 구문을 CommonJS require/exports로 변환
        'plugins': ['@babel/plugin-transform-modules-commonjs'],
      })
    )
    .pipe(gulp.dest('lib/cjs/')) // CommonJS 형태로 출력
}

// ===== ES6 모듈 빌드 파이프라인 =====
// TypeScript 소스를 ES6 모듈로 컴파일하는 핵심 빌드 시스템
//
// 처리 흐름:
// 1. TypeScript → JavaScript 컴파일 (타입 제거)
// 2. Babel로 .less import 경로를 .css로 변환
// 3. ES6 모듈 형태로 출력 (트리 셰이킹 최적화 지원)
//
// Why: 최신 브라우저와 번들러를 위한 최적화된 모듈 제공
// How: TypeScript 컴파일러 + 커스텀 Babel 플러그인 조합
function buildES() {
  const tsProject = ts({
    ...tsconfig.compilerOptions, // 프로젝트 TypeScript 설정 재사용
    module: 'ES6', // ES6 모듈 형태로 출력 지정
  })
  return gulp
    .src(['src/**/*.{ts,tsx}'], {
      ignore: ['**/demos/**/*', '**/tests/**/*'], // 데모와 테스트 파일 제외
    })
    .pipe(tsProject) // TypeScript 컴파일 실행
    .pipe(
      babel({
        // 커스텀 플러그인: import './style.less' → import './style.css'
        // Why: 컴파일된 CSS 파일을 참조하도록 경로 수정 필요
        'plugins': ['./babel-transform-less-to-css'],
      })
    )
    .pipe(gulp.dest('lib/es/')) // ES6 모듈로 출력
}

// ===== TypeScript 타입 선언 빌드 시스템 =====
// .d.ts 파일을 생성하여 TypeScript 프로젝트에서 타입 안전성과 IntelliSense 지원
//
// 핵심 기능:
// - JavaScript 코드 생성 없이 타입 선언만 추출
// - 외부 라이브러리 타입 경로 명시적 해결
// - ES6/CommonJS 양쪽 모듈에 동일한 타입 정보 제공
//
// Why: TypeScript 개발자를 위한 완전한 타입 지원 제공
// How: TypeScript 컴파일러의 declaration 모드 활용
function buildDeclaration() {
  const tsProject = ts({
    ...tsconfig.compilerOptions, // 기본 설정 상속
    paths: {
      ...tsconfig.compilerOptions.paths,
      // 외부 의존성 타입 경로 명시적 해결 (모노레포 환경 대응)
      'react': ['node_modules/@types/react'], // React 타입 정의
      'rc-field-form': ['node_modules/rc-field-form'], // 폼 라이브러리 타입
      '@react-spring/web': ['node_modules/@react-spring/web'], // 애니메이션 라이브러리
      '@use-gesture/react': ['node_modules/@use-gesture/react'], // 제스처 핸들링
    },
    module: 'ES6',
    declaration: true, // .d.ts 파일 생성 활성화
    emitDeclarationOnly: true, // JavaScript 파일은 생성하지 않음 (타입만 추출)
  })
  return gulp
    .src(['src/**/*.{ts,tsx}'], {
      ignore: ['**/demos/**/*', '**/tests/**/*'],
    })
    .pipe(tsProject) // 타입 선언 파일 생성
    .pipe(gulp.dest('lib/es/')) // ES6 모듈용 타입 선언
    .pipe(gulp.dest('lib/cjs/')) // CommonJS 모듈용 타입 선언
}

// ===== Vite 번들 설정 생성기 =====
// 개발/프로덕션 환경별로 다양한 모듈 형태(ES, CJS, UMD)를 생성하는 다이내믹 설정 시스템
//
// 핵심 설계:
// - 환경별 최적화: 개발 시 디버깅 용이성, 프로덕션 시 최소 용량
// - 모듈 호환성: ES6, CommonJS, UMD 모두 동시 지원
// - 외부 의존성 처리: React 번들 크기 최적화를 위해 외부화
//
// Why: 하나의 설정으로 모든 배포 형태를 일관성 있게 처리
// How: 고차 함수로 환경과 형태를 매개변수로 받아 동적 설정 생성
function getViteConfigForPackage({ env, formats, external }) {
  const name = packageJson.name // 패키지명에서 번들 파일명 결정
  const isProd = env === 'production' // 환경별 최적화 레벨 설정
  return {
    root: process.cwd(), // 현재 작업 디렉토리를 루트로 설정

    mode: env, // Vite 빌드 모드 설정

    logLevel: 'silent', // 빌드 로그 최소화 (자동화된 빌드에 적합)

    define: { 'process.env.NODE_ENV': `"${env}"` }, // 런타임 환경 변수 주입

    build: {
      cssTarget: 'chrome61', // CSS 타겟 브라우저 설정 (모바일 최적화)
      lib: {
        name: 'antdMobile', // UMD 등에서 사용될 글로벌 변수명
        entry: './lib/es/index.js', // 번들 진입점 (이미 컴파일된 ES6 코드)
        formats, // ['es', 'cjs', 'umd'] 등 출력 형태 배열
        // 환경별 파일명 생성: 개발 시 .development, 프로덕션 시 접미사 없음
        fileName: format => `${name}.${format}${isProd ? '' : `.${env}`}.js`,
      },
      rollupOptions: {
        external, // 외부 의존성 목록 (React 등 번들에서 제외)
        output: {
          dir: './lib/bundle', // 번들 출력 디렉토리
          // exports: 'named',  // named export 옵션 (주석 처리됨)
          globals: {
            // UMD에서 외부 의존성을 참조할 글로벌 변수명 매핑
            'react': 'React', // window.React
            'react-dom': 'ReactDOM', // window.ReactDOM
          },
        },
      },
      minify: isProd ? 'esbuild' : false, // 프로덕션에서만 ESBuild로 고속 미니파이
    },
  }
}

// ===== 통합 번들 빌드 시스템 =====
// 개발/프로덕션 환경을 순차적으로 처리하여 모든 모듈 형태를 생성
//
// 핵심 전략:
// - 순차 처리: CSS 파일 이름 충돌 방지 (프로덕션이 개발용을 덮어서어야 함)
// - 폴더 리셋 제어: 첫 번째 빌드만 디렉토리 정리, 나머지는 추가 모드
// - 외부 의존성: React 계열을 번들에서 제외하여 크기 최적화
//
// Why: 다양한 사용 시나리오를 위한 완전한 번들 세트 제공
// How: Vite의 라이브러리 모드 + Rollup 옵션으로 고성능 번들링
async function buildBundles(cb) {
  const envs = ['development', 'production'] // 개발과 프로덕션 두 환경 모두 지원
  const configs = envs.map(env =>
    getViteConfigForPackage({
      env,
      formats: ['es', 'cjs', 'umd'], // 3가지 모듈 형태 동시 빌드
      external: ['react', 'react-dom'], // React 의존성 외부화 (번들 크기 최적화)
    })
  )

  // 순차 처리로 style.css 파일 이름 충돌 방지
  // 프로덕션 버전이 개발 버전을 덮어써야 하는 전략
  for (let i = 0; i < configs.length; i += 1) {
    const config = configs[i]
    if (i !== 0) {
      config.build.emptyOutDir = false // 첫 번째 이후는 폴더를 비우지 않음 (기존 파일 보존)
    }

    await vite.build(config) // 비동기 빌드 실행 (병렬 처리 대신 순차 처리)
  }

  cb && cb() // Gulp 콜백 함수 실행 (선택적)
}

// ===== Webpack UMD 번들 + 분석 시스템 =====
// 레거시 환경과 CDN 사용을 위한 UMD 형태 생성 + 상세한 번들 분석 리포트 제공
//
// 핵심 기능:
// 1. UMD 번들: AMD, CommonJS, 글로벌 변수 모든 모듈 시스템 지원
// 2. 번들 분석: BundleAnalyzer + Statoscope로 상세한 최적화 정보 수집
// 3. 모바일 최적화: iOS 9+, Chrome 49+ 타겟으로 레거시 모바일 지원
// 4. 자산 인라인화: 이미지 등을 번들에 포함하여 단일 파일로 배포
//
// Why: CDN에서 링크 하나로 즉시 사용 가능한 쮄플립 솔루션 제공
// How: Webpack의 강력한 번들링 + 분석 도구로 완전한 최적화 파이프라인
function umdWebpack() {
  return gulp
    .src('lib/es/index.js') // 이미 컴파일된 ES6 모듈을 입력으로 사용
    .pipe(
      webpackStream(
        {
          output: {
            filename: 'antd-mobile.js', // 고정된 UMD 번들 파일명
            library: {
              type: 'umd', // Universal Module Definition - 모든 모듈 시스템 지원
              name: 'antdMobile', // 글로벌 스코프에서 접근할 변수명 (window.antdMobile)
            },
          },
          mode: 'production', // 프로덕션 모드 - 최대 최적화 적용
          optimization: {
            usedExports: true, // 트리 셰이킹 활성화 - 사용하지 않는 코드 제거
          },
          performance: {
            hints: false, // 성능 경고 비활성화 (단일 번들 파일 전략)
          },
          resolve: {
            extensions: ['.js', '.json'], // 지원하는 파일 확장자
          },
          plugins: [
            // ===== 번들 분석 도구들 =====
            new BundleAnalyzerPlugin({
              analyzerMode: 'static', // 정적 HTML 리포트 생성
              openAnalyzer: false, // 빌드 후 브라우저 자동 열기 비활성화
              reportFilename: 'report/report.html', // 시각적 번들 분석 리포트
            }),
            new StatoscopeWebpackPlugin({
              saveReportTo: 'report/statoscope/report.html', // 상세 분석 리포트
              saveStatsTo: 'report/statoscope/stats.json', // 원시 통계 데이터
              open: false, // 빌드 후 자동 열기 비활성화
            }),
          ],
          module: {
            rules: [
              // ===== JavaScript/TypeScript 처리 =====
              {
                test: /\.m?js$/, // ES6 모듈 및 일반 JS 파일 매칭
                use: {
                  loader: 'babel-loader', // Babel 트랜스파일러 사용
                  options: {
                    'presets': [
                      [
                        '@babel/preset-env', // 타겟 브라우저 기반 호환성 변환
                        {
                          'loose': true, // 빠른 변환을 위한 loose 모드
                          'modules': false, // ES6 모듈은 Webpack이 처리하도록 유지
                          'targets': {
                            'chrome': '49', // Android WebView 최소 지원 버전
                            'ios': '9', // iOS Safari 최소 지원 버전
                          },
                        },
                      ],
                      '@babel/preset-typescript', // TypeScript 지원
                      '@babel/preset-react', // JSX 변환 지원
                    ],
                  },
                },
              },
              // ===== 이미지 자산 처리 =====
              {
                test: /\.(png|svg|jpg|gif|jpeg)$/, // 이미지 파일 매칭
                type: 'asset/inline', // Base64로 인라인화 (단일 번들 파일 전략)
              },
              // ===== CSS 스타일 처리 =====
              {
                test: /\.css$/i, // CSS 파일 매칭
                use: ['style-loader', 'css-loader'], // CSS를 JavaScript로 인젝하여 DOM에 주입
              },
            ],
          },
          // ===== 외부 의존성 설정 =====
          externals: [
            // 번들에서 제외할 라이브러리 목록 (번들 크기 최적화)
            {
              react: {
                // React 라이브러리 외부 참조 설정
                commonjs: 'react', // CommonJS 환경: require('react')
                commonjs2: 'react', // CommonJS2 환경: module.exports
                amd: 'react', // AMD 환경: define(['react'], ...)
                root: 'React', // 브라우저 환경: window.React
              },
              'react-dom': {
                // ReactDOM 라이브러리 외부 참조 설정
                commonjs: 'react-dom',
                commonjs2: 'react-dom',
                amd: 'react-dom',
                root: 'ReactDOM', // 브라우저 환경: window.ReactDOM
              },
            },
          ],
        },
        webpack // Webpack 인스턴스 전달
      )
    )
    .pipe(gulp.dest('lib/umd/')) // UMD 번들 출력 디렉토리
}

// ===== 호환성 UMD 파일 생성 시스템 =====
// Webpack UMD 번들을 bundle 디렉토리에 호환성 이름으로 복사
// Why: 다양한 CDN과 배포 환경에서 일관된 파일명으로 접근할 수 있도록 지원
// How: 기존 UMD 파일을 호환성을 나타내는 이름으로 복사하여 선택권 제공
function copyUmd() {
  return gulp
    .src(['lib/umd/antd-mobile.js']) // Webpack으로 생성된 UMD 번들
    .pipe(rename('antd-mobile.compatible.umd.js')) // 호환성을 명시하는 파일명으로 변경
    .pipe(gulp.dest('lib/bundle/')) // 통합 번들 디렉토리에 배치
}

// ===== 메타데이터 파일 복사 시스템 =====
// 패키지 문서와 라이선스를 배포 패키지에 포함
// Why: npm 패키지 배포 시 필수 정보와 법적 요구사항 충족
// How: 루트 디렉토리의 문서 파일들을 lib 폴더로 복사
function copyMetaFiles() {
  return gulp.src(['./README.md', './LICENSE.txt']).pipe(gulp.dest('./lib/'))
}

// ===== 배포용 package.json 생성 시스템 =====
// 개발용 package.json에서 배포에 불필요한 정보를 제거하여 최적화된 패키지 메타데이터 생성
//
// 제거 대상:
// - scripts: 개발 스크립트 (빌드, 테스트 등)
// - devDependencies: 개발 의존성
// - publishConfig: 배포 설정 (npm registry 등)
// - files: 포함 파일 목록 (이미 빌드된 상태이므로 불필요)
// - resolutions: 의존성 해결 규칙
// - packageManager: 패키지 매니저 지정
//
// Why: 배포 패키지 크기 최소화 및 불필요한 정보 노출 방지
// How: Through2 스트림으로 JSON 파싱 → 필드 삭제 → 재직렬화
function generatePackageJSON() {
  return gulp
    .src('./package.json')
    .pipe(
      through.obj((file, enc, cb) => {
        // 스트림 변환 함수
        const rawJSON = file.contents.toString() // Buffer를 문자열로 변환
        const parsed = JSON.parse(rawJSON) // JSON 파싱

        // 배포에 불필요한 필드들 제거 (배포 패키지 최적화)
        delete parsed.scripts // 빌드/테스트 스크립트 제거
        delete parsed.devDependencies // 개발 의존성 제거
        delete parsed.publishConfig // npm 배포 설정 제거
        delete parsed.files // 파일 목록 제거 (이미 빌드됨)
        delete parsed.resolutions // Yarn/npm 의존성 해결 규칙 제거
        delete parsed.packageManager // 패키지 매니저 지정 제거

        const stringified = JSON.stringify(parsed, null, 2) // 2칸 들여쓰기로 재직렬화
        file.contents = Buffer.from(stringified) // Buffer로 다시 변환
        cb(null, file) // 다음 파이프로 전달
      })
    )
    .pipe(gulp.dest('./lib/')) // 배포용 package.json 출력
}

// ===== 2x 해상도 폴더 초기화 시스템 =====
// 전체 lib 폴더 구조를 2x 폴더에 복사하여 고해상도 버전 기반 생성
// Why: Retina 디스플레이 등 고해상도 환경을 위한 2배 크기 스타일 제공
// How: 기존 빌드 결과물을 복사한 후 CSS만 픽셀 값 2배 처리 예정
function init2xFolder() {
  return gulp
    .src('./lib/**', {
      base: './lib/', // 디렉토리 구조 유지를 위한 기준 경로
    })
    .pipe(gulp.dest('./lib/2x/')) // 2x 해상도용 폴더에 전체 구조 복사
}

// ===== 2x 해상도 CSS 변환 시스템 =====
// 1x 해상도 CSS의 모든 픽셀 값을 2배로 변환하여 고해상도 디스플레이 지원
//
// 핵심 도전 과제:
// - postcss-px-multiple 플러그인이 @supports 구문을 제대로 처리하지 못하는 호환성 문제
// - CSS 변수 폴백을 위한 @supports 구문을 임시로 다른 구문으로 변경했다가 복구해야 함
//
// 처리 과정:
// 1. @supports 구문을 임시로 @media 쿼리로 치환 (플러그인 호환성 해킹)
// 2. postcss-px-multiple로 모든 px 값을 2배로 변환
// 3. @media 쿼리를 다시 @supports 구문으로 복구
// 4. 기존 파일 덮어쓰기
//
// Why: 고해상도 디스플레이에서 선명한 UI 제공 (iPhone Retina, 고해상도 Android 등)
// How: PostCSS 플러그인 + 정교한 텍스트 치환으로 호환성 문제 우회
function build2xCSS() {
  return (
    gulp
      .src('./lib/2x/**/*.css', {
        base: './lib/2x/', // 디렉토리 구조 유지
      })
      // ===== 호환성 해킹: @supports → @media 임시 변환 =====
      // postcss-px-multiple이 @supports 블록을 무시하는 버그 우회
      .pipe(
        replace(
          '@supports not (color: var(--adm-color-text))', // CSS 변수 지원 감지
          '@media screen and (min-width: 999999px)' // 절대 매칭되지 않는 미디어 쿼리로 임시 변경
        )
      )
      // ===== 픽셀 값 2배 변환 =====
      .pipe(postcss([pxMultiplePlugin])) // 모든 px 값에 2를 곱함 (예: 16px → 32px)
      // ===== 호환성 해킹: @media → @supports 복구 =====
      .pipe(
        replace(
          '@media screen and (min-width: 999999px)', // 임시 미디어 쿼리
          '@supports not (color: var(--adm-color-text))' // 원래 @supports 구문으로 복구
        )
      )
      .pipe(
        gulp.dest('./lib/2x', {
          overwrite: true, // 기존 1x CSS 파일을 2x 버전으로 덮어쓰기
        })
      )
  )
}

// ===== 개별 태스크 Export =====
// 단독 실행이 필요한 태스크들을 외부에서 접근 가능하도록 export
exports.umdWebpack = umdWebpack // Webpack UMD 번들링 단독 실행
exports.buildBundles = buildBundles // Vite 번들링 단독 실행

// ===== 메인 빌드 파이프라인 =====
// 전체 빌드 과정을 순차적/병렬로 조율하여 다양한 환경과 해상도를 지원하는 완전한 배포 패키지 생성
//
// 빌드 단계별 상세 설명:
// 1. clean: 이전 빌드 산출물 완전 제거
// 2. buildES: TypeScript → ES6 모듈 컴파일
// 3. buildCJS: ES6 → CommonJS 변환 (효율적 2단계 변환)
// 4. 병렬 처리: buildDeclaration(타입 선언) + buildStyle(CSS 컴파일)
// 5. copyAssets: 정적 자산 복사
// 6. copyMetaFiles: README, LICENSE 복사
// 7. generatePackageJSON: 배포용 package.json 생성
// 8. buildBundles: Vite로 다양한 번들 형태 생성
// 9. 순차 처리: init2xFolder + build2xCSS (고해상도 지원)
// 10. umdWebpack: 상세 분석이 포함된 Webpack UMD 번들
// 11. copyUmd: 호환성 UMD 파일 생성
// 12-13. copyPatchStyle: CSS 변수 폴백 파일 복사 (1x/2x 모두)
//
// 설계 철학:
// - 순차/병렬 전략: 의존성이 있는 작업은 순차, 독립적인 작업은 병렬
// - 점진적 변환: TypeScript → ES6 → CommonJS (일관성 보장)
// - 다중 배포: ES6, CommonJS, UMD, Bundle 모두 지원
// - 해상도 대응: 1x/2x 모두 지원으로 모바일 최적화
exports.default = gulp.series(
  clean, // 1. 환경 정리
  buildES, // 2. ES6 모듈 빌드
  buildCJS, // 3. CommonJS 변환
  gulp.parallel(buildDeclaration, buildStyle), // 4. 타입 선언 + 스타일 (병렬)
  copyAssets, // 5. 정적 자산 복사
  copyMetaFiles, // 6. 메타 파일 복사
  generatePackageJSON, // 7. 배포용 메타데이터
  buildBundles, // 8. Vite 다중 번들
  gulp.series(init2xFolder, build2xCSS), // 9. 2x 해상도 처리 (순차)
  umdWebpack, // 10. Webpack UMD + 분석
  copyUmd, // 11. 호환성 UMD 쪽사
  copyPatchStyle(), // 12. CSS 패치 (1x)
  copyPatchStyle('/2x') // 13. CSS 패치 (2x)
)
